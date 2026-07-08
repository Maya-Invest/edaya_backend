import type { AuthorizationRepositories } from '@edaya/authorization'
import { AuthorizationError, dispatchAttendanceRecordAccess, dispatchLessonSessionAccess, dispatchLessonSessionReadAccess } from '@edaya/authorization'
import { AttendanceRecord, AttendanceStatus, StudentClassEnrollmentStatus } from '@edaya/core'
import { describe, expect, mock, test } from 'bun:test'
import { AuthFixtures } from '../../support/authorization-fixtures'

function lessonRepos(classSubjectId = 'cs-math', classGroupId = 'class-1'): AuthorizationRepositories {
  return {
    lessonSessions: {
      findByIds: mock(async (ids: readonly string[]) =>
        ids.map(id => ({ id, classGroupId, classSubjectId })),
      ),
      findById: mock(async (id: string) => ({ id, classGroupId, classSubjectId })),
    },
    classSubjects: {
      findByIds: mock(async (ids: readonly string[]) =>
        ids.map(id => ({ id, classGroupId })),
      ),
    },
    staffAssignments: {
      list: mock(async () => []),
    },
    enrollments: {
      list: mock(async () => []),
    },
  } as unknown as AuthorizationRepositories
}

function attendanceRepos(classGroupId = 'class-1'): AuthorizationRepositories {
  return {
    attendances: {
      findByIds: mock(async (ids: readonly string[]) =>
        ids.map(id => ({ id, classGroupId })),
      ),
      findById: mock(async (id: string) => ({ id, classGroupId })),
    },
    enrollments: {
      list: mock(async (filter: { studentId?: { $in?: string[] } } = {}) => {
        const studentIds = filter.studentId?.$in ?? []
        return studentIds.map(studentId => ({
          id: `enrollment-${studentId}`,
          studentId,
          classGroupId,
          status: StudentClassEnrollmentStatus.Active,
        }))
      }),
    },
    staffAssignments: {
      list: mock(async () => []),
    },
  } as unknown as AuthorizationRepositories
}

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

describe('dispatchLessonSessionReadAccess', () => {
  test('allows subject teacher to read lesson sessions in an assigned class group', async () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    await dispatchLessonSessionReadAccess(actor, ['session-1', 'session-2'], lessonRepos('cs-french', 'class-1'))
  })

  test('denies subject teacher for lesson sessions outside assigned class groups', async () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    const repos = {
      lessonSessions: {
        findByIds: mock(async (ids: readonly string[]) =>
          ids.map(id => ({ id, classGroupId: 'class-2', classSubjectId: 'cs-french' })),
        ),
      },
      classSubjects: {
        findByIds: mock(async (ids: readonly string[]) =>
          ids.map(id => ({ id, classGroupId: 'class-1' })),
        ),
      },
    } as unknown as AuthorizationRepositories
    await expectForbidden(dispatchLessonSessionReadAccess(actor, ['session-1'], repos))
  })
})

describe('dispatchLessonSessionAccess', () => {
  test('allows teacher assigned to class subject', async () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    await dispatchLessonSessionAccess(actor, ['session-1'], lessonRepos())
  })

  test('denies unassigned teacher', async () => {
    const actor = AuthFixtures.teacher.unassigned()
    await expectForbidden(dispatchLessonSessionAccess(actor, ['session-1'], lessonRepos()))
  })

  test('allows student enrolled in class group', async () => {
    const actor = AuthFixtures.student.enrolledIn('class-1')
    await dispatchLessonSessionAccess(actor, ['session-1'], lessonRepos())
  })
})

describe('dispatchAttendanceRecordAccess', () => {
  test('allows teacher session attendance for assigned subject', async () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    const record = new AttendanceRecord({
      id: 'record-1',
      studentId: 'student-1',
      lessonSessionId: 'session-1',
      date: new Date('2026-09-01'),
      status: AttendanceStatus.Present,
    })
    const repos = {
      ...lessonRepos('cs-math', 'class-1'),
      ...attendanceRepos('class-1'),
    } as unknown as AuthorizationRepositories
    await dispatchAttendanceRecordAccess(actor, [record], repos)
  })

  test('allows teacher daily attendance for homeroom class', async () => {
    const actor = AuthFixtures.teacher.homeroom('class-1')
    const record = new AttendanceRecord({
      id: 'record-2',
      studentId: 'student-1',
      attendanceId: 'attendance-1',
      date: new Date('2026-09-01'),
      status: AttendanceStatus.Present,
    })
    const repos = {
      ...lessonRepos('cs-math', 'class-1'),
      ...attendanceRepos('class-1'),
    } as unknown as AuthorizationRepositories
    await dispatchAttendanceRecordAccess(actor, [record], repos)
  })
})
