import { AccessPolicies, createStaffActorMetadata } from '@edaya/authorization'
import { Permission, StaffAssignment, StaffMember, StaffPermissionAssignment } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { usePooledDatabases } from '../../../adaptor-postgres/tests/support/pooled-database'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

const actor = createStaffActorMetadata({ subjectId: 'person-a', staffMemberId: 'staff-a', schoolId: 'school-a', requestId: 'own-assignments', authenticatedAt: new Date() })

describe('staff assignment visibility', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await fixture.repositories.staffMembers.save(new StaffMember({ id: 'other-staff', schoolId: 'school-a', firstName: 'Other', lastName: 'Staff' }))
    for (const [id, staffId, classGroupId, academicYearId] of [['own', 'staff-a', 'class-a', 'year-a'], ['other', 'other-staff', 'class-a', 'year-a'], ['foreign', 'staff-b', 'class-b', 'year-b']] as const)
      await fixture.repositories.staffAssignments.save(new StaffAssignment({ id, staffId, academicYearId, classGroupId, responsibility: 'Supervision' }))
  })
  afterEach(async () => {
    await releaseDatabase(fixture.db)
  })

  test('staff see their own business assignments, without access to another staff profile or permission administration', async () => {
    const access = new AccessPolicies(actor, fixture.repositories)
    const scope = await access.entity('staffAssignments').readScope()
    const repository = fixture.repositories.staffAssignments.forAccess(scope)
    expect((await repository.list()).map(assignment => assignment.id)).toEqual(['own'])
    expect(await repository.count()).toBe(1)
    expect(await repository.list({ staffId: 'other-staff' })).toEqual([])
    expect(await repository.findById('foreign')).toBeUndefined()
    await expect(access.entity('staffAssignments').assertDelete(['own'])).rejects.toThrow()
    await expect(access.entity('staffPermissionAssignments').readScope()).rejects.toThrow()
  })

  test('permission administrators can read school assignments, and revocation leaves only their personal assignments', async () => {
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'admin-read', schoolId: 'school-a', academicYearId: 'year-a', staffId: 'staff-a', permission: Permission.ACCESS_CONTROL_READ, scopes: [{ kind: 'school' }] }))
    const access = new AccessPolicies(actor, fixture.repositories)
    expect(await fixture.repositories.staffAssignments.forAccess(await access.entity('staffAssignments').readScope()).count()).toBe(2)
    await fixture.repositories.staffPermissionAssignments.delete('admin-read')
    expect(await fixture.repositories.staffAssignments.forAccess(await access.entity('staffAssignments').readScope()).count()).toBe(1)
  })
})
