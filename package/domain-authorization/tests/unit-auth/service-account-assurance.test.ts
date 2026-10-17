import { AccessPolicies, ActorAssuranceLevel, AuthorizationError, createServiceStaffActorMetadata, createStaffActorMetadata } from '@edaya/authorization'
import { corePermissionDefinition, Permission, StaffMember, StaffPermissionAssignment } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase } from '../../../adaptor-postgres/tests/support/authorization-database'

describe('assurance and account kind in complete policies', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
  })
  afterEach(async () => {
    await fixture.db.close()
  })

  const identity = { schoolId: 'school-a', staffMemberId: 'staff-a', subjectId: 'person-a', requestId: 'assurance', authenticatedAt: new Date() }
  async function grant(permission: Permission) {
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: permission, schoolId: 'school-a', staffId: 'staff-a', academicYearId: 'year-a', permission, scopes: corePermissionDefinition(permission).scopePolicy.mode === 'resources' ? [{ kind: 'all', grain: 'student' }] : [{ kind: 'school' }] }))
  }

  test.each([Permission.SERVICE_ACCOUNT_MANAGE, Permission.SERVICE_ACCOUNT_MANAGE, Permission.PAYMENT_RECORD, Permission.PAYMENT_CANCEL, Permission.PAYMENT_REVERSE, Permission.FINANCIAL_CATALOG_MANAGE])('%s needs verified human assurance and a current grant', async (permission) => {
    await grant(permission)
    const standard = new AccessPolicies(createStaffActorMetadata({ ...identity, assuranceLevel: ActorAssuranceLevel.Standard }), fixture.repositories)
    const verified = new AccessPolicies(createStaffActorMetadata({ ...identity, assuranceLevel: ActorAssuranceLevel.Verified }), fixture.repositories)
    await expect(standard.scope(permission, 'students', 'write')).rejects.toBeInstanceOf(AuthorizationError)
    await verified.scope(permission, 'students', 'write')
    await fixture.repositories.staffPermissionAssignments.delete(permission)
    await expect(verified.scope(permission, 'students', 'write')).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('owner authority bypasses service-management step-up only, and disappears after ownership transfer', async () => {
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    const access = new AccessPolicies(createStaffActorMetadata({ ...identity, assuranceLevel: ActorAssuranceLevel.Standard }), fixture.repositories)
    await access.serviceAccounts.assertCreate({ elevated: true })
    await expect(access.assertSchool(Permission.PAYMENT_REVERSE)).rejects.toThrow()
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'new-owner\' WHERE id = \'school-a\'')
    await expect(access.serviceAccounts.assertCreate({ elevated: true })).rejects.toThrow()
  })

  test.each([false, true])('service account elevated=%s never manages service credentials', async (elevated) => {
    const existing = (await fixture.repositories.staffMembers.findById('staff-a'))!
    await fixture.repositories.staffMembers.save(new StaffMember({ ...existing.data, subjectId: undefined, accountKind: 'service', serviceId: 'integration', serviceElevated: elevated }))
    const access = new AccessPolicies(createServiceStaffActorMetadata(identity), fixture.repositories)
    for (const permission of [Permission.SERVICE_ACCOUNT_READ, Permission.SERVICE_ACCOUNT_MANAGE, Permission.SERVICE_ACCOUNT_MANAGE, Permission.SERVICE_ACCOUNT_MANAGE, Permission.SERVICE_ACCOUNT_MANAGE]) {
      await grant(permission)
      await expect(access.assertSchool(permission)).rejects.toThrow()
    }
    await grant(Permission.PAYMENT_RECORD)
    await access.scope(Permission.PAYMENT_RECORD, 'students', 'write')
    await grant(Permission.ACCESS_CONTROL_MANAGE)
    if (elevated)
      await access.assertSchool(Permission.ACCESS_CONTROL_MANAGE)
    else await expect(access.assertSchool(Permission.ACCESS_CONTROL_MANAGE)).rejects.toThrow()
    await fixture.repositories.staffMembers.save(new StaffMember({ ...existing.data, subjectId: undefined, accountKind: 'service', serviceId: 'integration', serviceElevated: elevated, isActive: false }))
    await expect(access.scope(Permission.PAYMENT_RECORD, 'students', 'write')).rejects.toThrow()
  })
})
