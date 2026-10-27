import { AccessFacts, ActorAssuranceLevel, assertGrantDelegation, createStaffActorMetadata } from '@edaya/authorization'
import { Permission, StaffPermissionAssignment } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { usePooledDatabases } from '../../../adaptor-postgres/tests/support/pooled-database'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

describe('delegation of typed manual authority', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  const now = new Date('2026-05-01T00:00:00Z')
  const grant = { permission: Permission.GRADE_MANAGE, academicYearId: 'year-a', scopes: [{ kind: 'class_group' as const, classGroupId: 'class-a' }], startsAt: new Date('2026-01-01'), endsAt: new Date('2026-12-31') }
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ ...grant, id: 'held', schoolId: 'school-a', staffId: 'staff-a' }))
  })
  afterEach(async () => {
    await releaseDatabase(fixture.db)
  })
  function facts() {
    return new AccessFacts(createStaffActorMetadata({ schoolId: 'school-a', subjectId: 'person-a', staffMemberId: 'staff-a', requestId: 'delegation', authenticatedAt: now, assuranceLevel: ActorAssuranceLevel.Verified }), fixture.repositories, now)
  }

  test('requires the same action, complete placement, year and contained validity', async () => {
    await assertGrantDelegation(facts(), [{ ...grant, startsAt: now }])
    for (const requested of [
      { ...grant, permission: Permission.GRADE_READ },
      { ...grant, scopes: [{ kind: 'class_group' as const, classGroupId: 'class-other' }] },
      { ...grant, academicYearId: 'year-old' },
      { ...grant, scopes: [{ kind: 'class_group' as const, classGroupId: 'class-b' }] },
      { ...grant, startsAt: new Date('2025-12-31') },
      { ...grant, endsAt: undefined },
      { ...grant, endsAt: new Date('2027-01-01') },
    ]) await expect(assertGrantDelegation(facts(), [requested])).rejects.toThrow()
    await fixture.repositories.staffPermissionAssignments.delete('held')
    await expect(assertGrantDelegation(facts(), [grant])).rejects.toThrow()
  })

  test('an owner still cannot delegate cross-school, wrong-year or platform grants', async () => {
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    await assertGrantDelegation(facts(), [{ ...grant, endsAt: undefined }])
    await expect(assertGrantDelegation(facts(), [{ ...grant, scopes: [{ kind: 'class_group', classGroupId: 'class-b' }] }])).rejects.toThrow()
    await expect(assertGrantDelegation(facts(), [{ ...grant, academicYearId: 'year-old' }])).rejects.toThrow()
    await expect(assertGrantDelegation(facts(), [{ ...grant, permission: Permission.PLATFORM_REGISTER_SCHOOL, scopes: [{ kind: 'school' }] }])).rejects.toThrow()
  })
})
