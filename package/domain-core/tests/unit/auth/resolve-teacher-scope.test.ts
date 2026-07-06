import { describe, expect, test } from 'bun:test'
import { EMPTY_TEACHER_SCOPE } from '../../../src/capabilities/authorization/model/actor-scope'
import { resolveTeacherScope } from '../../../src/capabilities/authorization/resolution/resolve-teacher-scope'
import { Teacher, TeacherAssignment, TeacherAssignmentKind, TeacherAssignmentStatus } from '../../../src/domain'

describe('resolveTeacherScope', () => {
  test('returns empty scope when teacher has no active assignments', async () => {
    const repositories = {
      teachers: {
        findById: async () => new Teacher({
          id: 'teacher-1',
          schoolId: 'school-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          isActive: true,
        }),
      },
      academicYears: {
        findOne: async () => ({ id: 'year-1', schoolId: 'school-1', isActive: true }),
      },
      teacherAssignments: {
        list: async () => [],
      },
    }

    await expect(resolveTeacherScope({
      teacherId: 'teacher-1',
      schoolId: 'school-1',
      repositories: repositories as never,
    })).resolves.toEqual(EMPTY_TEACHER_SCOPE)
  })

  test('collects subject and homeroom scopes from active assignments', async () => {
    const repositories = {
      teachers: {
        findById: async () => new Teacher({
          id: 'teacher-1',
          schoolId: 'school-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          isActive: true,
        }),
      },
      academicYears: {
        findOne: async () => ({ id: 'year-1', schoolId: 'school-1', isActive: true }),
      },
      teacherAssignments: {
        list: async () => [
          new TeacherAssignment({
            id: 'ta-1',
            academicYearId: 'year-1',
            teacherId: 'teacher-1',
            kind: TeacherAssignmentKind.Subject,
            classSubjectId: 'cs-1',
            status: TeacherAssignmentStatus.Active,
          }),
          new TeacherAssignment({
            id: 'ta-2',
            academicYearId: 'year-1',
            teacherId: 'teacher-1',
            kind: TeacherAssignmentKind.Homeroom,
            classGroupId: 'cg-1',
            status: TeacherAssignmentStatus.Active,
          }),
        ],
      },
    }

    await expect(resolveTeacherScope({
      teacherId: 'teacher-1',
      schoolId: 'school-1',
      repositories: repositories as never,
    })).resolves.toEqual({
      teaching: { classSubjectIds: ['cs-1'] },
      homeroom: { classGroupIds: ['cg-1'] },
    })
  })

  test('excludes ended and future assignments while retaining them in the repository list', async () => {
    const endedAssignment = new TeacherAssignment({
      id: 'ta-ended',
      academicYearId: 'year-1',
      teacherId: 'teacher-1',
      kind: TeacherAssignmentKind.Subject,
      classSubjectId: 'cs-ended',
      status: TeacherAssignmentStatus.Ended,
      endsAt: new Date('2026-01-01T00:00:00Z'),
    })
    const futureAssignment = new TeacherAssignment({
      id: 'ta-future',
      academicYearId: 'year-1',
      teacherId: 'teacher-1',
      kind: TeacherAssignmentKind.Subject,
      classSubjectId: 'cs-future',
      status: TeacherAssignmentStatus.Active,
      startsAt: new Date('2026-12-01T00:00:00Z'),
    })
    const activeAssignment = new TeacherAssignment({
      id: 'ta-active',
      academicYearId: 'year-1',
      teacherId: 'teacher-1',
      kind: TeacherAssignmentKind.Subject,
      classSubjectId: 'cs-active',
      status: TeacherAssignmentStatus.Active,
    })
    const allAssignments = [endedAssignment, futureAssignment, activeAssignment]

    const repositories = {
      teachers: {
        findById: async () => new Teacher({
          id: 'teacher-1',
          schoolId: 'school-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          isActive: true,
        }),
      },
      academicYears: {
        findOne: async () => ({ id: 'year-1', schoolId: 'school-1', isActive: true }),
      },
      teacherAssignments: {
        list: async () => allAssignments,
      },
    }

    await expect(resolveTeacherScope({
      teacherId: 'teacher-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      repositories: repositories as never,
      now: new Date('2026-06-01T00:00:00Z'),
    })).resolves.toEqual({
      teaching: { classSubjectIds: ['cs-active'] },
      homeroom: { classGroupIds: [] },
    })

    expect(allAssignments).toHaveLength(3)
  })
})
