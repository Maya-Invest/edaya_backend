import {
  assertOperation,
  AttendanceOperations,
  AuthorizationError,
  GradeOperations,
  GuardianCapability,
  Permission,
  SchedulingOperations,
  StudentOperations,
} from '@edaya/authorization'
import { describe, expect, test } from 'bun:test'
import { AuthFixtures } from '../../support/authorization-fixtures'

describe('assertOperation', () => {
  test('allows system actors without evaluating operation rules', () => {
    expect(() => assertOperation(
      { kind: 'system', schoolId: 'school-1', systemId: 'test', requestId: 'test', reason: 'unit' },
      StudentOperations.update,
    )).not.toThrow()
  })

  test('rejects staff actors when operation has no staff rule', () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    expect(() => assertOperation(
      actor as never,
      StudentOperations.update,
    )).toThrow(AuthorizationError)
  })

  test('evaluates staff anyOf rules with scoped context', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.QUERY_STUDENT_DETAIL_READ])
    expect(() => assertOperation(
      actor,
      StudentOperations.directoryRead,
      { studentId: 'student-1' },
      'full',
    )).not.toThrow()
  })

  test('passes class group scope into staff authorization when operation declares scopeFrom', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.TIMETABLE_UPDATE])
    expect(() => assertOperation(
      actor,
      SchedulingOperations.timetableManage,
      { classGroupId: 'cg-7a' },
      'full',
    )).not.toThrow()
    expect(() => assertOperation(
      actor,
      SchedulingOperations.timetablePublish,
      { classGroupId: 'cg-7a' },
      'full',
    )).not.toThrow()
  })

  test('passes student scope into staff authorization when operation declares scopeFrom', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.QUERY_STUDENT_DETAIL_READ])
    expect(() => assertOperation(
      actor,
      StudentOperations.directoryRead,
      { studentId: 'student-1', classGroupId: 'cg-7a' },
      'full',
    )).not.toThrow()
  })

  test('uses attendance record scopeFrom for staff authorization', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.ATTENDANCE_RECORD])
    expect(() => assertOperation(
      actor,
      AttendanceOperations.record,
      { classGroupId: 'cg-7a' },
      'full',
    )).not.toThrow()
  })

  test('rejects staff when operation defines no staff path', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.STUDENT_READ])
    const guardianOnlyOperation = {
      id: 'test.guardian-only',
      definition: {
        id: 'test.guardian-only',
        guardian: { capability: GuardianCapability.ReadSelfProfile },
      },
    } as never

    expect(() => assertOperation(actor, guardianOnlyOperation)).toThrow(AuthorizationError)
  })

  test('requires full-mode context keys when operation declares them', () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    expect(() => assertOperation(
      actor,
      GradeOperations.input,
      undefined,
      'full',
    )).toThrow(/requires context/)
  })

  test('allows teacher module mode without class subject when assignment exists', () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    expect(() => assertOperation(
      actor,
      GradeOperations.input,
      undefined,
      'module',
    )).not.toThrow()
  })

  test('routes guardian operations through guardian capabilities', () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    expect(() => assertOperation(
      actor,
      StudentOperations.directoryRead,
      { studentId: 'student-1' },
    )).not.toThrow()
  })

  test('rejects guardian operations without portal capability wiring', () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    expect(() => assertOperation(
      actor,
      StudentOperations.update,
    )).toThrow(AuthorizationError)
  })

  test('routes student operations through student capabilities', () => {
    const actor = AuthFixtures.student.enrolledIn('class-1', 'student-1')
    expect(() => assertOperation(
      actor,
      StudentOperations.directoryRead,
      { studentId: 'student-1' },
    )).not.toThrow()
  })

  test('evaluates teacher anyOf fallback rules', () => {
    const actor = AuthFixtures.teacher.homeroom('cg-7a')
    expect(() => assertOperation(
      actor,
      StudentOperations.directoryRead,
      { classGroupId: 'cg-7a' },
    )).not.toThrow()
  })
})
