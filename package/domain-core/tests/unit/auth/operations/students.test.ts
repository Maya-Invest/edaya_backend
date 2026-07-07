import { describe, expect, test } from 'bun:test'
import { operationModule } from '../../../../src/application/entities/entity-config'
import {
  AuthorizationError,
  DisciplineOperations,
  EnrollmentOperations,
  GuardianOperations,
  Permission,
  StudentOperations,
} from '../../../../src/capabilities/authorization'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { describeOperationMatrix } from '../../../support/operation-matrix'

describeOperationMatrix(StudentOperations.directoryRead, [
  {
    label: 'staff with student directory read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.QUERY_STUDENT_DIRECTORY_READ]),
    expect: 'allow',
  },
  {
    label: 'assigned teacher',
    actor: () => AuthFixtures.teacher.subject('cs-math'),
    expect: 'allow',
  },
  {
    label: 'guardian linked student',
    actor: () => AuthFixtures.guardian.linkedTo('student-1'),
    expect: 'allow',
  },
  {
    label: 'student self read',
    actor: () => AuthFixtures.student.enrolledIn('class-1'),
    expect: 'allow',
  },
])

describe('StudentOperations.update', () => {
  test('requires STUDENT_UPDATE', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.STUDENT_UPDATE])
    expect(() => operationModule(StudentOperations.update)(actor)).not.toThrow()
  })
})

describeOperationMatrix(GuardianOperations.read, [
  {
    label: 'staff with guardian admin read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ]),
    expect: 'allow',
  },
  {
    label: 'guardian self read',
    actor: () => AuthFixtures.guardian.linkedTo('student-1'),
    expect: 'allow',
  },
  {
    label: 'teacher denied',
    actor: () => AuthFixtures.teacher.subject('cs-math'),
    expect: 'deny',
  },
])

describeOperationMatrix(EnrollmentOperations.read, [
  {
    label: 'staff with enrollment read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.ENROLLMENT_READ]),
    expect: 'allow',
  },
  {
    label: 'assigned teacher',
    actor: () => AuthFixtures.teacher.subject('cs-math'),
    expect: 'allow',
  },
])

describe('DisciplineOperations.validate', () => {
  test('requires DISCIPLINE_VALIDATE', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.DISCIPLINE_VALIDATE])
    expect(() => operationModule(DisciplineOperations.validate)(actor)).not.toThrow()
  })

  test('denies teachers', () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    expect(() => operationModule(DisciplineOperations.validate)(actor)).toThrow(AuthorizationError)
  })
})
