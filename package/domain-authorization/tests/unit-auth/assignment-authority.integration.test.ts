import { AccessPolicies, ActorAssuranceLevel, AuthorizationError, createStaffActorMetadata, describeActionGrants } from '@edaya/authorization'
import { Assessment, LessonSession, Permission, StaffAssignment, StaffMember, StaffPermissionAssignment } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { seedAuthorizationRelationships } from '../../../adaptor-postgres/tests/support/authorization-database'
import { usePooledDatabases } from '../../../adaptor-postgres/tests/support/pooled-database'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

describe('authority from current staff assignments', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  const actor = createStaffActorMetadata({ schoolId: 'school-a', staffMemberId: 'staff-a', subjectId: 'person-a', authenticatedAt: new Date(), requestId: 'assignment', assuranceLevel: ActorAssuranceLevel.Verified })
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
  })
  afterEach(async () => {
    await releaseDatabase(fixture.db)
  })

  function assignment(target: { classGroupId?: string, classSubjectId?: string, lessonSessionId?: string, assessmentId?: string }, permission = Permission.GRADE_MANAGE) {
    return new StaffAssignment({ id: 'duty', staffId: 'staff-a', academicYearId: 'year-a', responsibility: 'Invigilator', permissions: [permission], ...target })
  }

  test('a subject duty never grants grade input for another subject in the same class', async () => {
    await fixture.repositories.staffAssignments.save(assignment({ classSubjectId: 'math-a' }))
    const access = new AccessPolicies(actor, fixture.repositories)
    await access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    for (const assessmentId of ['assessment-french', 'assessment-other', 'assessment-b'])
      await expect(access.grades.assertInput({ assessmentId, studentId: 'student-a' })).rejects.toBeInstanceOf(AuthorizationError)
    expect(await fixture.repositories.staffPermissionAssignments.count()).toBe(0)
    expect((await describeActionGrants(actor, fixture.repositories))[0]?.scopes).toEqual([{ kind: 'subject', gradeLevelId: 'level-a', classGroupId: 'class-a', subjectId: 'math' }])
  })

  test('an assessment duty cannot affect another assessment for the same subject', async () => {
    const original = (await fixture.repositories.assessments.findById('assessment-math'))!
    await fixture.repositories.assessments.save(new Assessment({ ...original.data, id: 'second-math' }))
    await fixture.repositories.staffAssignments.save(assignment({ assessmentId: 'assessment-math' }))
    const access = new AccessPolicies(actor, fixture.repositories)
    await access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    await expect(access.grades.assertInput({ assessmentId: 'second-math', studentId: 'student-a' })).rejects.toThrow()
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-other' })).rejects.toThrow()
    const results = fixture.repositories.assessmentResults.forAccess(await access.scope(Permission.GRADE_MANAGE, 'assessmentResults', 'write'))
    expect((await results.list()).map(row => row.id)).toEqual(['1-math'])
    await fixture.repositories.staffAssignments.delete('duty')
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
  })

  test('a lesson duty follows only assessments and results anchored to that lesson', async () => {
    const lesson = new LessonSession({ id: 'lesson', schoolId: 'school-a', classGroupId: 'class-a', classSubjectId: 'math-a', startsAt: new Date('2026-05-01T09:00:00Z'), endsAt: new Date('2026-05-01T10:00:00Z'), displayLabel: 'Math' })
    await fixture.repositories.lessonSessions.save(lesson)
    const original = (await fixture.repositories.assessments.findById('assessment-math'))!
    await fixture.repositories.assessments.save(new Assessment({ ...original.data, id: 'unrelated-math' }))
    await fixture.repositories.assessments.save(new Assessment({ ...original.data, lessonSessionId: lesson.id }))
    await fixture.repositories.staffAssignments.save(assignment({ lessonSessionId: lesson.id }))
    const access = new AccessPolicies(actor, fixture.repositories)
    await access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    await expect(access.grades.assertInput({ assessmentId: 'unrelated-math', studentId: 'student-a' })).rejects.toThrow()
    expect((await describeActionGrants(actor, fixture.repositories))[0]?.scopes).toEqual([{ kind: 'lesson_session', lessonSessionId: 'lesson', classGroupId: 'class-a', classSubjectId: 'math-a' }])
  })

  test('assignment delegation preserves exact scope and cannot produce broader manual grants', async () => {
    await fixture.repositories.staffAssignments.save(assignment({ classSubjectId: 'math-a' }))
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'administrator', schoolId: 'school-a', staffId: 'staff-a', academicYearId: 'year-a', permission: Permission.ACCESS_CONTROL_MANAGE, scopes: [{ kind: 'school' }] }))
    await fixture.repositories.staffMembers.save(new StaffMember({ id: 'helper', schoolId: 'school-a', firstName: 'Helper', lastName: 'Staff' }))
    const access = new AccessPolicies(actor, fixture.repositories)
    const same = new StaffAssignment({ ...assignment({ classSubjectId: 'math-a' }).data, permissions: [Permission.GRADE_MANAGE], id: 'delegated', staffId: 'helper' })
    await fixture.atomic.execute(async () => {
      const scope = await access.entity('staffAssignments').assertSave(same)
      await fixture.repositories.staffAssignments.forAccess(scope).save(same)
    })
    const broader = new StaffAssignment({ id: 'broad', staffId: 'helper', academicYearId: 'year-a', responsibility: 'Invigilator', classGroupId: 'class-a', permissions: [Permission.GRADE_MANAGE] })
    await expect(access.entity('staffAssignments').assertSave(broader)).rejects.toThrow()
    await expect(access.entity('staffPermissionAssignments').assertSave(new StaffPermissionAssignment({ id: 'manual', schoolId: 'school-a', staffId: 'helper', academicYearId: 'year-a', permission: Permission.GRADE_MANAGE, scopes: [{ kind: 'class_group', classGroupId: 'class-a' }] }))).rejects.toThrow()
    expect(await fixture.repositories.staffPermissionAssignments.count()).toBe(1)
    expect(await fixture.repositories.staffAssignments.count()).toBe(2)
  })

  test('role labels do not create permissions and changing the academic year removes current authority', async () => {
    await fixture.repositories.staffAssignments.save(new StaffAssignment({ ...assignment({ classGroupId: 'class-a' }).data, responsibility: 'Principal', permissions: [] }))
    const access = new AccessPolicies(actor, fixture.repositories)
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
    await fixture.repositories.staffAssignments.save(assignment({ classGroupId: 'class-a' }))
    await expect(new AccessPolicies({ ...actor, academicYearId: 'year-old' }, fixture.repositories).grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
    await expect(access.entity('staffAssignments').assertSave(assignment({ classGroupId: 'class-b' }))).rejects.toThrow()
  })
})
