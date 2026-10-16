import { AccessPolicies, createStaffActorMetadata } from '@edaya/authorization'
import { GradeScale, Permission, StaffPermissionAssignment } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase, seedAuthorizationRelationships } from '../../../adaptor-postgres/tests/support/authorization-database'

describe('grading configuration catalog access', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  const actor = createStaffActorMetadata({ schoolId: 'school-a', staffMemberId: 'staff-a', subjectId: 'person-a', academicYearId: 'year-a', requestId: 'grading-catalog', authenticatedAt: new Date() })

  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
    for (const schoolId of ['school-a', 'school-b']) {
      await fixture.repositories.gradeScales.save(new GradeScale({ id: `scale-${schoolId}`, schoolId, name: 'Sur 20', minScore: 0, maxScore: 20, intervalConvention: 'continuous', ranges: [{ id: `range-${schoolId}`, letter: 'A', interpretation: 'Pass', minScore: 0, maxScore: 20 }] }))
    }
  })
  afterEach(async () => {
    await fixture.db.close()
  })

  test.each([Permission.REPORT_CARD_CONFIGURE, Permission.EXAM_CONFIG_CONFIGURE])('%s can read its school scales without a school-wide marks grant', async (permission) => {
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'configure', schoolId: 'school-a', staffId: 'staff-a', permission, academicYearId: 'year-a', scopes: [{ kind: 'school' }] }))
    // The seeded principal's marks access is scoped to classes; scales have no class placement.
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'marks', schoolId: 'school-a', staffId: 'staff-a', permission: Permission.GRADE_READ, academicYearId: 'year-a', scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] }))
    const access = new AccessPolicies(actor, fixture.repositories)
    const scales = fixture.repositories.gradeScales.forAccess(await access.entity('gradeScales').readScope())
    expect((await scales.list({ $limit: 1, $offset: 0 })).map(row => row.id)).toEqual(['scale-school-a'])
    expect(await scales.count()).toBe(1)
    expect(await scales.findById('scale-school-b')).toBeUndefined()
    expect(await scales.findById('scale-school-a')).toMatchObject({ intervalConvention: 'continuous' })
    const marks = fixture.repositories.assessmentResults.forAccess(await access.entity('assessmentResults').readScope())
    expect((await marks.list({ $orderBy: [{ field: 'id', direction: 'asc' }] })).map(row => row.id)).toEqual(['1-math', '2-french'])
    expect(await marks.findById('3-other')).toBeUndefined()
  })

  test('a staff account without a grading action cannot read the catalog', async () => {
    const access = new AccessPolicies(actor, fixture.repositories)
    await expect(access.entity('gradeScales').readScope()).rejects.toThrow('No authority')
  })
})
