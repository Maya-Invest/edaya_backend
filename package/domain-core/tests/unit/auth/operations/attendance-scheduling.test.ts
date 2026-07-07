import { describe, expect, test } from 'bun:test'
import { operationModule } from '../../../../src/application/entities/entity-config'
import { AttendanceOperations, AuthorizationError, Permission, SchedulingOperations } from '../../../../src/capabilities/authorization'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { describeOperationMatrix } from '../../../support/operation-matrix'

describe('AttendanceOperations', () => {
  test('attendance.record module gate allows assigned teachers', () => {
    const assigned = AuthFixtures.teacher.subject('cs-math', ['cg-7a'])
    expect(() => operationModule(AttendanceOperations.record)(assigned)).not.toThrow()

    const unassigned = AuthFixtures.teacher.unassigned()
    expect(() => operationModule(AttendanceOperations.record)(unassigned)).toThrow(AuthorizationError)
  })

  test('attendance.record with lesson context for teachers', () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    expect(() => operationModule(AttendanceOperations.record, { classSubjectId: 'cs-math' })(actor)).not.toThrow()
  })

  test('attendance.record homeroom fallback', () => {
    const actor = AuthFixtures.teacher.homeroom('cg-7a')
    expect(() => operationModule(AttendanceOperations.record, { classGroupId: 'cg-7a' })(actor)).not.toThrow()
  })
})

describeOperationMatrix(AttendanceOperations.read, [
  {
    label: 'staff with ATTENDANCE_READ',
    actor: () => AuthFixtures.staff.withPermissions([Permission.ATTENDANCE_READ]),
    expect: 'allow',
  },
  {
    label: 'staff with ATTENDANCE_JUSTIFY',
    actor: () => AuthFixtures.staff.withPermissions([Permission.ATTENDANCE_JUSTIFY]),
    expect: 'allow',
  },
  {
    label: 'guardian linked student',
    actor: () => AuthFixtures.guardian.linkedTo('student-1'),
    expect: 'allow',
    context: { studentId: 'student-1' },
  },
])

describe('SchedulingOperations', () => {
  test('timetable.read allows assigned teachers', () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    expect(() => operationModule(SchedulingOperations.timetableRead)(actor)).not.toThrow()
  })

  test('timetable.manage is staff-only', () => {
    const staff = AuthFixtures.staff.withPermissions([Permission.TIMETABLE_UPDATE])
    expect(() => operationModule(SchedulingOperations.timetableManage)(staff)).not.toThrow()
    expect(() => operationModule(SchedulingOperations.timetableManage)(AuthFixtures.teacher.subject('cs-math'))).toThrow(AuthorizationError)
  })
})

describeOperationMatrix(SchedulingOperations.timetableRead, [
  {
    label: 'staff with QUERY_TIMETABLE_READ',
    actor: () => AuthFixtures.staff.withPermissions([Permission.QUERY_TIMETABLE_READ]),
    expect: 'allow',
  },
  {
    label: 'student self read',
    actor: () => AuthFixtures.student.enrolledIn('class-1'),
    expect: 'allow',
  },
])
