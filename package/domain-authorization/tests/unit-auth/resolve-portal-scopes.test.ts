import { resolveGuardianScope, resolveStudentScope } from '@edaya/authorization'
import { StudentClassEnrollmentStatus } from '@edaya/core'
import { describe, expect, mock, test } from 'bun:test'

describe('resolve portal scopes', () => {
  test('builds guardian scope from links and enrollments', async () => {
    const scope = await resolveGuardianScope({
      guardianId: 'guardian-1',
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

    expect(scope.studentIds).toEqual(['student-1'])
    expect(scope.classGroupIds).toEqual(['class-1'])
  })

  test('builds student scope from active enrollment', async () => {
    const scope = await resolveStudentScope({
      studentId: 'student-1',
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

    expect(scope.studentId).toBe('student-1')
    expect(scope.classGroupId).toBe('class-1')
  })
})
