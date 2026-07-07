import { describe, expect, test } from 'bun:test'
import { operationModule } from '../../../../src/application/entities/entity-config'
import { AuthorizationError, Permission } from '../../../../src/capabilities/authorization'
import { AssessmentOperations } from '../../../../src/capabilities/authorization/operations/assessments'
import { GradeOperations } from '../../../../src/capabilities/authorization/operations/grades'
import { LogbookOperations } from '../../../../src/capabilities/authorization/operations/logbook'
import { WorkspaceOperations } from '../../../../src/capabilities/authorization/operations/workspace'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { describeOperationMatrix } from '../../../support/operation-matrix'

describe('operationModule', () => {
  test('workspace.read allows assigned teachers and denies unassigned', () => {
    const assigned = AuthFixtures.teacher.subject('cs-math')
    expect(() => operationModule(WorkspaceOperations.read)(assigned)).not.toThrow()

    const unassigned = AuthFixtures.teacher.unassigned()
    expect(() => operationModule(WorkspaceOperations.read)(unassigned)).toThrow(AuthorizationError)
  })

  test('grades.input module gate allows staff with GRADE_INPUT', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.GRADE_INPUT])
    expect(() => operationModule(GradeOperations.input)(actor)).not.toThrow()
  })

  test('grades.input with context requires matching classSubject for teachers', () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    expect(() => operationModule(GradeOperations.input, { classSubjectId: 'cs-math' })(actor)).not.toThrow()
    expect(() => operationModule(GradeOperations.input, { classSubjectId: 'cs-other' })(actor)).toThrow(AuthorizationError)
  })

  test('assessments.create requires matching classSubject for teachers', () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    expect(() => operationModule(AssessmentOperations.create, { classSubjectId: 'cs-math' })(actor)).not.toThrow()
    expect(() => operationModule(AssessmentOperations.create, { classSubjectId: 'cs-other' })(actor)).toThrow(AuthorizationError)
  })

  test('logbook.create requires matching classSubject for teachers', () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    expect(() => operationModule(LogbookOperations.create, { classSubjectId: 'cs-math' })(actor)).not.toThrow()
    expect(() => operationModule(LogbookOperations.create, { classSubjectId: 'cs-other' })(actor)).toThrow(AuthorizationError)
  })

  test('teacher anyOf allows homeroom fallback for grade read', () => {
    const actor = AuthFixtures.teacher.homeroom('cg-7a')
    expect(() => operationModule(GradeOperations.read, { classGroupId: 'cg-7a' })(actor)).not.toThrow()
  })
})

describeOperationMatrix(GradeOperations.read, [
  {
    label: 'staff with GRADE_READ',
    actor: () => AuthFixtures.staff.withPermissions([Permission.GRADE_READ]),
    expect: 'allow',
  },
  {
    label: 'teacher subject scope',
    actor: () => AuthFixtures.teacher.subject('cs-math'),
    expect: 'allow',
    context: { classSubjectId: 'cs-math' },
  },
  {
    label: 'unassigned teacher denied',
    actor: () => AuthFixtures.teacher.unassigned(),
    expect: 'deny',
    context: { classSubjectId: 'cs-math' },
  },
  {
    label: 'guardian linked student',
    actor: () => AuthFixtures.guardian.linkedTo('student-1'),
    expect: 'allow',
    context: { studentId: 'student-1' },
  },
  {
    label: 'student self read',
    actor: () => AuthFixtures.student.enrolledIn('class-1'),
    expect: 'allow',
  },
])

describeOperationMatrix(GradeOperations.input, [
  {
    label: 'staff with GRADE_INPUT at module gate',
    actor: () => AuthFixtures.staff.withPermissions([Permission.GRADE_INPUT]),
    expect: 'allow',
  },
  {
    label: 'teacher with assignment at module gate',
    actor: () => AuthFixtures.teacher.subject('cs-math'),
    expect: 'allow',
  },
  {
    label: 'guardian denied',
    actor: () => AuthFixtures.guardian.linkedTo('student-1'),
    expect: 'deny',
  },
])
