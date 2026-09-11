import type { TeacherActorScope } from '../../src/model/actor-scope'
import { StudentClassEnrollmentStatus, Teacher, TeacherAssignment, TeacherAssignmentKind } from '@edaya/core'
import { describe, expect, mock, test } from 'bun:test'
import { resolveActorScope } from '../../src/resolution/resolve-actor-scope'

describe('resolveActorScope', () => {
  test('dispatches guardian scope resolution', async () => {
    const scope = await resolveActorScope({
      actorKind: 'guardian',
      actorId: 'guardian-1',
      schoolId: 'school-1',
      repositories: {
        guardians: {
          findById: mock(async () => ({ id: 'guardian-1', hasAccess: true, schoolId: 'school-1' })),
        },
        guardianLinks: {
          list: mock(async () => [{ guardianId: 'guardian-1', studentId: 'student-1', schoolId: 'school-1' }]),
        },
        enrollments: {
          list: mock(async () => [{
            studentId: 'student-1',
            classGroupId: 'class-1',
            status: StudentClassEnrollmentStatus.Active,
          }]),
        },
      } as never,
    })

    expect(scope).toEqual({
      studentIds: ['student-1'],
      classGroupIds: ['class-1'],
    })
  })

  test('dispatches student scope resolution', async () => {
    const scope = await resolveActorScope({
      actorKind: 'student',
      actorId: 'student-1',
      schoolId: 'school-1',
      repositories: {
        students: {
          findById: mock(async () => ({ id: 'student-1', schoolId: 'school-1' })),
        },
        enrollments: {
          list: mock(async () => [{
            studentId: 'student-1',
            classGroupId: 'class-1',
            status: StudentClassEnrollmentStatus.Active,
          }]),
        },
      } as never,
    })

    expect(scope).toEqual({
      studentId: 'student-1',
      classGroupId: 'class-1',
    })
  })

  test('dispatches teacher scope resolution', async () => {
    const scope = await resolveActorScope({
      actorKind: 'teacher',
      actorId: 'teacher-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      repositories: {
        teachers: {
          findById: mock(async () => new Teacher({
            id: 'teacher-1',
            schoolId: 'school-1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            isActive: true,
          })),
        },
        teacherAssignments: {
          list: mock(async () => [
            new TeacherAssignment({
              id: 'ta-1',
              teacherId: 'teacher-1',
              academicYearId: 'year-1',
              kind: TeacherAssignmentKind.Subject,
              classSubjectId: 'cs-1',
            }),
            new TeacherAssignment({
              id: 'ta-2',
              teacherId: 'teacher-1',
              academicYearId: 'year-1',
              kind: TeacherAssignmentKind.Homeroom,
              classGroupId: 'class-1',
            }),
          ]),
        },
      } as never,
    }) as TeacherActorScope

    expect(scope.teaching.classSubjectIds).toContain('cs-1')
    expect(scope.homeroom.classGroupIds).toContain('class-1')
  })
})
