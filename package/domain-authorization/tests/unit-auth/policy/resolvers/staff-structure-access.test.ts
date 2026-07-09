import type { AuthorizationRepositories } from '@edaya/authorization'
import {
  AuthorizationError,
  createSystemActorMetadata,
  Permission,
} from '@edaya/authorization'
import { AttendanceRecord, AttendanceStatus } from '@edaya/core'
import { describe, expect, mock, test } from 'bun:test'
import {
  checkActivitySessionAccess,
  checkAttendanceRecordAccess,
  checkLessonSessionAccess,
} from '../../../../src/policy/resolvers/scheduling'
import { checkStaffAssignmentAccess } from '../../../../src/policy/resolvers/staff-assignment'
import { checkStaffMemberReadAccess } from '../../../../src/policy/resolvers/staff-member'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { enrollmentRepos } from '../../../support/policy-fixtures'

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

describe('checkStaffMemberReadAccess', () => {
  test('allows system actor', async () => {
    const actor = createSystemActorMetadata({
      schoolId: 'school-1',
      systemId: 'test',
      requestId: 'test',
      reason: 'unit-test',
    })
    await checkStaffMemberReadAccess(actor, [{ id: 'staff-1' }])
  })

  test('allows staff self read without admin permissions', async () => {
    const actor = AuthFixtures.staff.withPermissions([])
    await checkStaffMemberReadAccess(actor, [{ id: 'staff-1' }])
  })

  test('allows staff to read other members with admin permissions', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.STAFF_READ])
    await checkStaffMemberReadAccess(actor, [{ id: 'staff-2' }])
  })

  test('denies staff without admin permissions for other members', async () => {
    const actor = AuthFixtures.staff.withPermissions([])
    await expectForbidden(checkStaffMemberReadAccess(actor, [{ id: 'staff-2' }]))
  })
})

describe('checkStaffAssignmentAccess', () => {
  test('allows system actor', async () => {
    const actor = createSystemActorMetadata({
      schoolId: 'school-1',
      systemId: 'test',
      requestId: 'test',
      reason: 'unit-test',
    })
    await checkStaffAssignmentAccess(actor, [{ staffId: 'staff-1' }])
  })

  test('allows staff self read without configure permission', async () => {
    const actor = AuthFixtures.staff.withPermissions([])
    await checkStaffAssignmentAccess(actor, [{ staffId: 'staff-1' }])
  })

  test('allows staff with school structure configure for other assignments', async () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.SCHOOL_STRUCTURE_CONFIGURE])
    await checkStaffAssignmentAccess(actor, [{ staffId: 'staff-2' }])
  })

  test('denies staff without configure permission for other assignments', async () => {
    const actor = AuthFixtures.staff.withPermissions([])
    await expectForbidden(checkStaffAssignmentAccess(actor, [{ staffId: 'staff-2' }]))
  })
})

describe('scheduling resolver dispatch', () => {
  const lessonRepos = (): AuthorizationRepositories => ({
    lessonSessions: {
      findByIds: mock(async (ids: readonly string[]) =>
        ids.map(id => ({ id, classGroupId: 'class-1', classSubjectId: 'cs-1' })),
      ),
    },
    classSubjects: {
      findByIds: mock(async (ids: readonly string[]) =>
        ids.map(id => ({ id, classGroupId: 'class-1' })),
      ),
    },
    staffAssignments: { list: mock(async () => []) },
    enrollments: { list: mock(async () => []) },
  } as unknown as AuthorizationRepositories)

  test('checkLessonSessionAccess delegates to scheduling strategy', async () => {
    const actor = AuthFixtures.teacher.subject('cs-1')
    await checkLessonSessionAccess(actor, ['session-1'], lessonRepos())
  })

  test('checkActivitySessionAccess delegates to scheduling strategy', async () => {
    const repos = {
      activitySessions: {
        findByIds: mock(async (ids: readonly string[]) =>
          ids.map(id => ({ id, classGroupId: 'class-1', activityId: 'act-1' })),
        ),
      },
      enrollments: { list: mock(async () => []) },
      staffAssignments: { list: mock(async () => []) },
    } as unknown as AuthorizationRepositories
    const actor = AuthFixtures.student.enrolledIn('class-1')
    await checkActivitySessionAccess(actor, ['activity-session-1'], repos)
  })

  test('checkAttendanceRecordAccess delegates to scheduling strategy', async () => {
    const record = new AttendanceRecord({
      id: 'record-1',
      studentId: 'student-1',
      lessonSessionId: 'session-1',
      date: new Date('2026-09-01'),
      status: AttendanceStatus.Present,
    })
    const repos = {
      ...enrollmentRepos('class-1'),
      lessonSessions: {
        findByIds: mock(async (ids: readonly string[]) =>
          ids.map(id => ({ id, classGroupId: 'class-1', classSubjectId: 'cs-1' })),
        ),
        findById: mock(async (id: string) => ({ id, classGroupId: 'class-1', classSubjectId: 'cs-1' })),
      },
      classSubjects: {
        findByIds: mock(async (ids: readonly string[]) =>
          ids.map(id => ({ id, classGroupId: 'class-1' })),
        ),
      },
      attendances: {
        findByIds: mock(async () => []),
        findById: mock(async () => undefined),
      },
    } as unknown as AuthorizationRepositories
    const actor = AuthFixtures.teacher.both('cs-1', 'class-1')
    await checkAttendanceRecordAccess(actor, [record], repos)
  })
})
