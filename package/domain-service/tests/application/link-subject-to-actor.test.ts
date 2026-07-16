import type { BusinessRuleViolationError } from '@edaya/core'
import type { BaseSchoolService } from '@edaya/service'
import { Guardian, GuardianStudentLink, RecordingNotificationGateway, StaffMember, Student, Teacher } from '@edaya/core'
import { assertEntitySubjectLinkable, linkSubjectToActor, unlinkSubjectFromActor } from '@edaya/service'
import { describe, expect, mock, test } from 'bun:test'

function createLinkContext() {
  const gateway = new RecordingNotificationGateway()
  const staffMember = new StaffMember({
    id: 'staff-1',
    schoolId: 'school-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@school.edu',
    isActive: true,
  })
  const guardian = new Guardian({
    id: 'guardian-1',
    schoolId: 'school-1',
    firstName: 'Grace',
    lastName: 'Hopper',
    hasAccess: true,
  })
  const teacher = new Teacher({
    id: 'teacher-1',
    schoolId: 'school-1',
    firstName: 'Alan',
    lastName: 'Turing',
    email: 'alan@school.edu',
    isActive: true,
  })
  const student = new Student({
    id: 'student-1',
    schoolId: 'school-1',
    firstName: 'Katherine',
    lastName: 'Johnson',
    subjectId: 'auth-old',
  })

  const repositories = {
    staffMembers: {
      findById: async (id: string) => (id === staffMember.id ? staffMember : undefined),
      findOne: async () => undefined,
    },
    guardians: {
      findById: async (id: string) => (id === guardian.id ? guardian : undefined),
      findOne: async () => undefined,
    },
    teachers: {
      findById: async (id: string) => (id === teacher.id ? teacher : undefined),
      findOne: async () => undefined,
    },
    students: {
      findById: async (id: string) => (id === student.id ? student : undefined),
      findOne: async () => undefined,
    },
    guardianLinks: {
      list: async () => [
        new GuardianStudentLink({
          id: 'link-1',
          schoolId: 'school-1',
          guardianId: guardian.id,
          studentId: student.id,
        }),
      ],
    },
  }

  const saved = {
    staffMembers: [] as StaffMember[],
    guardians: [] as Guardian[],
    teachers: [] as Teacher[],
    students: [] as Student[],
  }

  const baseService = {
    entities: {
      staffMembers: {
        save: mock(async (entity: StaffMember) => {
          saved.staffMembers.push(entity)
        }),
      },
      guardians: {
        save: mock(async (entity: Guardian) => {
          saved.guardians.push(entity)
        }),
      },
      teachers: {
        save: mock(async (entity: Teacher) => {
          saved.teachers.push(entity)
        }),
      },
      students: {
        save: mock(async (entity: Student) => {
          saved.students.push(entity)
        }),
      },
    },
    notificationGateway: gateway,
  } as unknown as BaseSchoolService

  return {
    baseService,
    repositories: repositories as Pick<
      import('../../src/ports').SchoolRepositories,
      'staffMembers' | 'guardians' | 'students' | 'teachers' | 'guardianLinks'
    >,
    saved,
    staffMember,
    guardian,
    teacher,
    student,
  }
}

describe('linkSubjectToActor', () => {
  test('assertEntitySubjectLinkable rejects replacing an existing subject link', () => {
    expect(() => assertEntitySubjectLinkable('auth-existing', 'auth-next'))
      .toThrowError(expect.objectContaining({
        code: 'ACTOR_SUBJECT_ALREADY_LINKED',
      } satisfies Partial<BusinessRuleViolationError>))
  })

  test('links staff, guardian, teacher, and student actors to auth subjects', async () => {
    const ctx = createLinkContext()

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

    expect(ctx.saved.staffMembers).toHaveLength(1)
    expect(ctx.saved.guardians).toHaveLength(1)
    expect(ctx.saved.teachers).toHaveLength(1)
    expect(ctx.saved.students).toHaveLength(1)
  })

  test('rejects ambiguous actor targets', async () => {
    const ctx = createLinkContext()

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
    const ctx = createLinkContext()
    const linkedStaff = new StaffMember({
      id: 'staff-1',
      schoolId: 'school-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@school.edu',
      subjectId: 'auth-staff',
      isActive: true,
    })
    ctx.repositories.staffMembers.findById = async () => linkedStaff

    const result = await unlinkSubjectFromActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { staffMemberId: 'staff-1' },
    )

    expect(result.entity.subjectId).toBeUndefined()
    expect(ctx.saved.staffMembers[0]?.subjectId).toBeUndefined()
  })

  test('clears guardian, teacher, and student subject links', async () => {
    const ctx = createLinkContext()
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

    ctx.repositories.guardians.findById = async () => linkedGuardian
    ctx.repositories.teachers.findById = async () => linkedTeacher
    ctx.repositories.students.findById = async () => linkedStudent

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
    expect(ctx.saved.guardians[0]?.subjectId).toBeUndefined()
    expect(ctx.saved.teachers[0]?.subjectId).toBeUndefined()
    expect(ctx.saved.students[0]?.subjectId).toBeUndefined()
  })

  test('returns entities that are already unlinked without saving', async () => {
    const ctx = createLinkContext()

    const result = await unlinkSubjectFromActor(
      ctx.baseService,
      ctx.repositories,
      'school-1',
      { staffMemberId: 'staff-1' },
    )

    expect(result.entity.id).toBe('staff-1')
    expect(ctx.saved.staffMembers).toHaveLength(0)
  })

  test('rejects missing actor targets in the school', async () => {
    const ctx = createLinkContext()

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
