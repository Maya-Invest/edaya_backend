import type { BusinessRuleViolationError } from '@edaya/core'
import { Guardian, GuardianStudentLink, RecordingNotificationGateway, StaffMember, Student, Teacher } from '@edaya/core'
import { assertEntitySubjectLinkable, linkSubjectToActor, unlinkSubjectFromActor } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../support/create-test-app'
import { createTestStaffActor } from '../support/test-actor'

async function createLinkContext() {
  const gateway = new RecordingNotificationGateway()
  const fixture = await createTestApp(createTestStaffActor('school-1', 'admin'), { owner: true, notificationGateway: gateway })
  const repositories = fixture.schoolRepositories
  await repositories.staffMembers.save(new StaffMember({ id: 'staff-1', schoolId: 'school-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@school.edu' }))
  await repositories.guardians.save(new Guardian({ id: 'guardian-1', schoolId: 'school-1', firstName: 'Grace', lastName: 'Hopper' }))
  await repositories.teachers.save(new Teacher({ id: 'teacher-1', schoolId: 'school-1', firstName: 'Alan', lastName: 'Turing', email: 'alan@school.edu' }))
  await repositories.students.save(new Student({ id: 'student-1', schoolId: 'school-1', firstName: 'Katherine', lastName: 'Johnson' }))
  await repositories.guardianLinks.save(new GuardianStudentLink({ id: 'link-1', schoolId: 'school-1', guardianId: 'guardian-1', studentId: 'student-1' }))
  return { baseService: fixture.app.baseService, repositories, gateway }
}

describe('linkSubjectToActor', () => {
  test('assertEntitySubjectLinkable rejects replacing an existing subject link', () => {
    expect(() => assertEntitySubjectLinkable('auth-existing', 'auth-next'))
      .toThrowError(expect.objectContaining({
        code: 'ACTOR_SUBJECT_ALREADY_LINKED',
      } satisfies Partial<BusinessRuleViolationError>))
  })

  test('links staff, guardian, teacher, and student actors to auth subjects', async () => {
    const ctx = await createLinkContext()

    const staffResult = await linkSubjectToActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { subjectId: 'auth-staff', staffMemberId: 'staff-1' },
    )
    expect(staffResult).toMatchObject({ kind: 'staff', entity: { subjectId: 'auth-staff' } })

    const guardianResult = await linkSubjectToActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { subjectId: 'auth-guardian', guardianId: 'guardian-1' },
    )
    expect(guardianResult).toMatchObject({ kind: 'guardian', entity: { subjectId: 'auth-guardian' } })

    const teacherResult = await linkSubjectToActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { subjectId: 'auth-teacher', teacherId: 'teacher-1' },
    )
    expect(teacherResult).toMatchObject({ kind: 'teacher', entity: { subjectId: 'auth-teacher' } })

    const studentResult = await linkSubjectToActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { subjectId: 'auth-student', studentId: 'student-1' },
    )
    expect(studentResult).toMatchObject({ kind: 'student', entity: { subjectId: 'auth-student' } })

    expect((await ctx.repositories.staffMembers.findById('staff-1'))?.subjectId).toBe('auth-staff')
    expect((await ctx.repositories.guardians.findById('guardian-1'))?.subjectId).toBe('auth-guardian')
    expect((await ctx.repositories.teachers.findById('teacher-1'))?.subjectId).toBe('auth-teacher')
    expect((await ctx.repositories.students.findById('student-1'))?.subjectId).toBe('auth-student')
  })

  test('rejects replacing an existing subject on the target actor', async () => {
    const ctx = await createLinkContext()
    await ctx.repositories.staffMembers.save(new StaffMember({
      id: 'staff-1',
      schoolId: 'school-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@school.edu',
      subjectId: 'auth-existing',
    }))

    await expect(linkSubjectToActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { subjectId: 'auth-next', staffMemberId: 'staff-1' },
    )).rejects.toMatchObject({
      code: 'ACTOR_SUBJECT_ALREADY_LINKED',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('rejects ambiguous actor targets', async () => {
    const ctx = await createLinkContext()

    await expect(linkSubjectToActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { subjectId: 'auth-1', staffMemberId: 'staff-1', teacherId: 'teacher-1' },
    )).rejects.toMatchObject({
      code: 'LINK_ACTOR_SUBJECT_AMBIGUOUS',
    } satisfies Partial<BusinessRuleViolationError>)
  })
})

describe('unlinkSubjectFromActor', () => {
  test('clears subject links and schedules recipient removal', async () => {
    const ctx = await createLinkContext()
    const linkedStaff = new StaffMember({
      id: 'staff-1',
      schoolId: 'school-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@school.edu',
      subjectId: 'auth-staff',
      isActive: true,
    })
    await ctx.repositories.staffMembers.save(linkedStaff)

    const result = await unlinkSubjectFromActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { staffMemberId: 'staff-1' },
    )

    expect(result.entity.subjectId).toBeUndefined()
    expect((await ctx.repositories.staffMembers.findById('staff-1'))?.subjectId).toBeUndefined()
  })

  test('clears guardian, teacher, and student subject links', async () => {
    const ctx = await createLinkContext()
    const linkedGuardian = new Guardian({
      id: 'guardian-1',
      schoolId: 'school-1',
      firstName: 'Grace',
      lastName: 'Hopper',
      subjectId: 'auth-guardian',
      hasAccess: true,
    })
    const linkedTeacher = new Teacher({
      id: 'teacher-1',
      schoolId: 'school-1',
      firstName: 'Alan',
      lastName: 'Turing',
      email: 'alan@school.edu',
      subjectId: 'auth-teacher',
      isActive: true,
    })
    const linkedStudent = new Student({
      id: 'student-1',
      schoolId: 'school-1',
      firstName: 'Katherine',
      lastName: 'Johnson',
      subjectId: 'auth-student',
    })

    await ctx.repositories.guardians.save(linkedGuardian)
    await ctx.repositories.teachers.save(linkedTeacher)
    await ctx.repositories.students.save(linkedStudent)

    const guardianResult = await unlinkSubjectFromActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { guardianId: 'guardian-1' },
    )
    const teacherResult = await unlinkSubjectFromActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { teacherId: 'teacher-1' },
    )
    const studentResult = await unlinkSubjectFromActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { studentId: 'student-1' },
    )

    expect(guardianResult.entity.subjectId).toBeUndefined()
    expect(teacherResult.entity.subjectId).toBeUndefined()
    expect(studentResult.entity.subjectId).toBeUndefined()
    expect((await ctx.repositories.guardians.findById('guardian-1'))?.subjectId).toBeUndefined()
    expect((await ctx.repositories.teachers.findById('teacher-1'))?.subjectId).toBeUndefined()
    expect((await ctx.repositories.students.findById('student-1'))?.subjectId).toBeUndefined()
  })

  test('returns entities that are already unlinked without saving', async () => {
    const ctx = await createLinkContext()

    const result = await unlinkSubjectFromActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { staffMemberId: 'staff-1' },
    )

    expect(result.entity.id).toBe('staff-1')
    expect((await ctx.repositories.staffMembers.findById('staff-1'))?.subjectId).toBeUndefined()
  })

  test('rejects missing actor targets in the school', async () => {
    const ctx = await createLinkContext()

    await expect(unlinkSubjectFromActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { teacherId: 'missing-teacher' },
    )).rejects.toMatchObject({
      code: 'INVITATION_TARGET_NOT_FOUND',
    } satisfies Partial<BusinessRuleViolationError>)
  })
})
