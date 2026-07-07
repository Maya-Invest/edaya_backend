import { describe, expect, test } from 'bun:test'
import { operationModule } from '../../../../src/application/entities/entity-config'
import { AuthorizationError, DisciplineOperations, Permission, ReportCardOperations } from '../../../../src/capabilities/authorization'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { describeOperationMatrix } from '../../../support/operation-matrix'

describe('DisciplineOperations', () => {
  test('discipline.read allows assigned teachers at module gate', () => {
    const assigned = AuthFixtures.teacher.subject('cs-math')
    expect(() => operationModule(DisciplineOperations.read)(assigned)).not.toThrow()

    const unassigned = AuthFixtures.teacher.unassigned()
    expect(() => operationModule(DisciplineOperations.read)(unassigned)).toThrow(AuthorizationError)
  })

  test('discipline.create with classSubject context for teachers', () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    expect(() => operationModule(DisciplineOperations.create, { classSubjectId: 'cs-math' })(actor)).not.toThrow()
  })

  test('discipline.create homeroom fallback', () => {
    const actor = AuthFixtures.teacher.homeroom('cg-7a')
    expect(() => operationModule(DisciplineOperations.create, { classGroupId: 'cg-7a' })(actor)).not.toThrow()
  })
})

describeOperationMatrix(DisciplineOperations.read, [
  {
    label: 'staff with DISCIPLINE_READ',
    actor: () => AuthFixtures.staff.withPermissions([Permission.DISCIPLINE_READ]),
    expect: 'allow',
  },
  {
    label: 'assigned teacher',
    actor: () => AuthFixtures.teacher.subject('cs-math'),
    expect: 'allow',
  },
  {
    label: 'unassigned teacher denied',
    actor: () => AuthFixtures.teacher.unassigned(),
    expect: 'deny',
  },
])

describe('ReportCardOperations', () => {
  test('report-cards.read allows guardian linked student context', () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    expect(() => operationModule(ReportCardOperations.read, { studentId: 'student-1' })(actor)).not.toThrow()
  })

  test('report-cards.comment staff requires REPORT_CARD_PUBLISH', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.REPORT_CARD_PUBLISH])
    expect(() => operationModule(ReportCardOperations.comment)(actor)).not.toThrow()
  })
})

describeOperationMatrix(ReportCardOperations.read, [
  {
    label: 'staff with report card read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.QUERY_REPORT_CARD_DETAIL_READ]),
    expect: 'allow',
  },
  {
    label: 'student self read',
    actor: () => AuthFixtures.student.enrolledIn('class-1'),
    expect: 'allow',
  },
  {
    label: 'guardian linked student',
    actor: () => AuthFixtures.guardian.linkedTo('student-1'),
    expect: 'allow',
    context: { studentId: 'student-1' },
  },
])
