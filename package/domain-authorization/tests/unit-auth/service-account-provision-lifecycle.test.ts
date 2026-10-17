import {
  ActorAssuranceLevel,
  AuthorizationError,
  createServiceAccount,
  createServiceStaffActorMetadata,
  createStaffActorMetadata,
  listServiceAccounts,
  revokeServiceAccount,
  rotateServiceAccountKey,
  updateServiceAccount,
} from '@edaya/authorization'
import { Permission, StaffPermissionAssignment } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { createAuthorizationDatabase } from '../../../adaptor-postgres/tests/support/authorization-database'

describe('service accounts with live grants and transactions', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  const actor = createStaffActorMetadata({ subjectId: 'person-a', staffMemberId: 'staff-a', schoolId: 'school-a', requestId: 'test', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified })
  const scopedGrant = { permission: Permission.GRADE_MANAGE, academicYearId: 'year-a', scopes: [{ kind: 'class_group' as const, classGroupId: 'class-a' }] }
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
  })
  afterEach(async () => {
    await fixture.db.close()
  })
  const create = (elevated = false) => createServiceAccount(fixture.repositories, actor, {
    serviceId: 'reports',
    displayName: 'Report Integration',
    elevated,
    ...(elevated ? {} : { permissionAssignments: [scopedGrant] }),
  }, fixture.atomic)

  test('creates a service identity and only its typed manual grants', async () => {
    const result = await create()
    expect(result.apiKey).toMatch(/^sk_live_/)
    expect(result.staffMember.accountKind).toBe('service')
    const grants = await fixture.repositories.staffPermissionAssignments.list({ staffId: result.staffMember.id })
    expect(grants).toHaveLength(1)
    expect(grants[0]?.scopes).toEqual(scopedGrant.scopes)
    expect(grants[0]?.permission).toBe(Permission.GRADE_MANAGE)
    expect(await listServiceAccounts(fixture.repositories, actor)).toHaveLength(1)
  })

  test('requires grants for delegated accounts and enforces the single elevated-account limit', async () => {
    await expect(createServiceAccount(fixture.repositories, actor, { serviceId: 'empty', displayName: 'Empty' }, fixture.atomic))
      .rejects
      .toMatchObject({ code: 'SERVICE_ACCOUNT_GRANTS_REQUIRED' })
    await create(true)
    await expect(createServiceAccount(fixture.repositories, actor, { serviceId: 'second', displayName: 'Second', elevated: true }, fixture.atomic))
      .rejects
      .toMatchObject({ code: 'OWNER_SERVICE_ACCOUNT_LIMIT' })
  })

  test('rejects duplicate active service ids but allows reuse after revocation', async () => {
    const first = await create()
    await expect(create()).rejects.toMatchObject({ code: 'SERVICE_ACCOUNT_ID_CONFLICT' })
    await revokeServiceAccount(fixture.repositories, actor, first.staffMember.id, fixture.atomic)
    expect((await create()).staffMember.id).not.toBe(first.staffMember.id)
  })

  test('updates the display and replaces grants without keeping duplicate authority', async () => {
    const { staffMember } = await create()
    const next = { ...scopedGrant, permission: Permission.GRADE_READ }
    const updated = await updateServiceAccount(fixture.repositories, actor, staffMember.id, {
      displayName: 'New Name',
      permissionAssignments: [next],
    }, fixture.atomic)
    expect(updated.fullName).toBe('New Name')
    const grants = await fixture.repositories.staffPermissionAssignments.list({ staffId: staffMember.id })
    expect(grants.map(grant => grant.permission)).toEqual([Permission.GRADE_READ])
    await expect(updateServiceAccount(fixture.repositories, actor, staffMember.id, {}, fixture.atomic))
      .rejects
      .toMatchObject({ code: 'SERVICE_ACCOUNT_UPDATE_EMPTY' })
  })

  test('rotates and revokes keys while preserving the account identity', async () => {
    const created = await create()
    const rotated = await rotateServiceAccountKey(fixture.repositories, actor, created.staffMember.id, {}, fixture.atomic)
    expect(rotated.apiKey).not.toBe(created.apiKey)
    const keys = await fixture.repositories.serviceApiKeys.list({ staffMemberId: created.staffMember.id })
    expect(keys.filter(key => !key.revokedAt)).toHaveLength(1)
    expect(keys.filter(key => key.revokedAt)).toHaveLength(1)
    const revoked = await revokeServiceAccount(fixture.repositories, actor, created.staffMember.id, fixture.atomic)
    expect(revoked.isActive).toBe(false)
    expect((await fixture.repositories.serviceApiKeys.list({ staffMemberId: created.staffMember.id })).every(key => !!key.revokedAt)).toBe(true)
    await expect(rotateServiceAccountKey(fixture.repositories, actor, created.staffMember.id, {}, fixture.atomic))
      .rejects
      .toMatchObject({ code: 'SERVICE_ACCOUNT_NOT_FOUND' })
  })

  test('rolls back the account and grants when key persistence fails', async () => {
    const save = spyOn(fixture.repositories.serviceApiKeys, 'save').mockRejectedValue(new Error('Key persistence failed'))
    try {
      await expect(create()).rejects.toThrow('Key persistence failed')
    }
    finally { save.mockRestore() }
    expect(await fixture.repositories.staffMembers.count({ accountKind: 'service' })).toBe(0)
    expect(await fixture.repositories.staffPermissionAssignments.count()).toBe(0)
  })

  test('owner service accounts cannot manage other service accounts', async () => {
    const created = await create(true)
    const machine = createServiceStaffActorMetadata({ subjectId: 'service-person', staffMemberId: created.staffMember.id, schoolId: 'school-a', requestId: 'machine', authenticatedAt: new Date() })
    await expect(createServiceAccount(fixture.repositories, machine, { serviceId: 'child', displayName: 'Child', elevated: true }, fixture.atomic))
      .rejects
      .toBeInstanceOf(AuthorizationError)
  })

  test('an administrator cannot rotate into broader grants or manage elevated accounts', async () => {
    const delegated = await create()
    const elevated = await createServiceAccount(fixture.repositories, actor, { serviceId: 'owner', displayName: 'Owner', elevated: true }, fixture.atomic)
    await fixture.db.exec('UPDATE schools SET owner_subject_id = null WHERE id = \'school-a\'')
    for (const permission of [Permission.SERVICE_ACCOUNT_MANAGE, Permission.SERVICE_ACCOUNT_MANAGE, Permission.SERVICE_ACCOUNT_MANAGE]) {
      await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
        id: permission,
        schoolId: 'school-a',
        staffId: 'staff-a',
        academicYearId: 'year-a',
        permission,
        scopes: [{ kind: 'school' }],
      }))
    }
    await expect(rotateServiceAccountKey(fixture.repositories, actor, delegated.staffMember.id, {}, fixture.atomic)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(rotateServiceAccountKey(fixture.repositories, actor, elevated.staffMember.id, {}, fixture.atomic)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(updateServiceAccount(fixture.repositories, actor, elevated.staffMember.id, { displayName: 'Changed' }, fixture.atomic)).rejects.toBeInstanceOf(AuthorizationError)
    await expect(revokeServiceAccount(fixture.repositories, actor, elevated.staffMember.id, fixture.atomic)).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: 'delegation',
      schoolId: 'school-a',
      staffId: 'staff-a',
      ...scopedGrant,
    }))
    expect((await rotateServiceAccountKey(fixture.repositories, actor, delegated.staffMember.id, {}, fixture.atomic)).apiKey).toMatch(/^sk_live_/)
  })
})
