import { ActorAssuranceLevel, AuthorizationError, createServiceAccount, createStaffActorMetadata, revokeServiceAccount, updateServiceAccount } from '@edaya/authorization'
import { noOpNotificationGateway, Permission, StaffMember, StaffPermissionAssignment } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase } from '../../../../adaptor-postgres/tests/support/authorization-database'
import { SchoolService } from '../../../src/services/school-service'
import { testFileStorage } from '../../support/test-file-storage'

describe('service accounts cannot be administered through ordinary staff entities', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let service: SchoolService
  let account: StaffMember
  const actor = createStaffActorMetadata({ staffMemberId: 'staff-a', subjectId: 'person-a', schoolId: 'school-a', requestId: 'service-target', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong })
  const requested = { permission: Permission.GRADE_MANAGE, academicYearId: 'year-a', scopes: [{ kind: 'class_group' as const, classGroupId: 'class-a' }] }
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    service = new SchoolService({ actor, repositories: fixture.repositories, atomicExecution: fixture.atomic, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage })
    account = (await createServiceAccount(fixture.repositories, actor, { serviceId: 'reports', displayName: 'Reports', permissionAssignments: [requested] }, fixture.atomic)).staffMember
  })
  afterEach(async () => fixture.db.close())

  test('generic save and mixed deletion batches cannot bypass service revocation', async () => {
    await expect(service.baseService.entities.staffMembers.save(new StaffMember({ ...account.data, isActive: false }))).rejects.toBeInstanceOf(AuthorizationError)
    await fixture.repositories.staffMembers.save(new StaffMember({ id: 'ordinary', schoolId: 'school-a', firstName: 'Human', lastName: 'Staff' }))
    await expect(service.baseService.entities.staffMembers.batchDelete(['ordinary', account.id])).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.staffMembers.findById('ordinary')).toBeDefined()
    expect((await fixture.repositories.staffMembers.findById(account.id))?.isActive).toBe(true)
    expect((await fixture.repositories.serviceApiKeys.list({ staffMemberId: account.id })).every(key => !key.revokedAt)).toBe(true)
    await revokeServiceAccount(fixture.repositories, actor, account.id, fixture.atomic)
    expect((await fixture.repositories.staffMembers.findById(account.id))?.isActive).toBe(false)
    expect((await fixture.repositories.serviceApiKeys.list({ staffMemberId: account.id })).every(key => !!key.revokedAt)).toBe(true)
  })

  test('ordinary grant commands cannot add, edit, reassign or delete service grants', async () => {
    const existing = (await fixture.repositories.staffPermissionAssignments.list({ staffId: account.id }))[0]!
    await expect(service.accessControlWorkflow.assignStaffPermission({ id: 'new-grant', schoolId: 'school-a', staffId: account.id, ...requested })).rejects.toBeInstanceOf(AuthorizationError)
    for (const change of [{ permission: Permission.GRADE_READ }, { staffId: actor.staffMemberId }]) {
      await expect(service.baseService.entities.staffPermissionAssignments.save(new StaffPermissionAssignment({ ...existing.data, scopes: [...existing.scopes], ...change }))).rejects.toBeInstanceOf(AuthorizationError)
    }
    await expect(service.baseService.entities.staffPermissionAssignments.delete(existing.id)).rejects.toBeInstanceOf(AuthorizationError)
    expect((await fixture.repositories.staffPermissionAssignments.findById(existing.id))?.data).toEqual(existing.data)
    await updateServiceAccount(fixture.repositories, actor, account.id, { permissionAssignments: [{ ...requested, permission: Permission.GRADE_READ }] }, fixture.atomic)
    expect((await fixture.repositories.staffPermissionAssignments.list({ staffId: account.id })).map(grant => grant.permission)).toEqual([Permission.GRADE_READ])
  })
})
