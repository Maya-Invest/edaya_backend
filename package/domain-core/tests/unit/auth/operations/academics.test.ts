import { describe, expect, test } from 'bun:test'
import { operationModule } from '../../../../src/application/entities/entity-config'
import {
  AcademicsOperations,
  AuthorizationError,
  Permission,
  QueryOperations,
  ServiceAccountOperations,
} from '../../../../src/capabilities/authorization'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { describeOperationMatrix } from '../../../support/operation-matrix'

describeOperationMatrix(AcademicsOperations.programRead, [
  {
    label: 'staff with class curriculum read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.QUERY_CLASS_CURRICULUM_READ]),
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
  {
    label: 'linked guardian',
    actor: () => AuthFixtures.guardian.linkedTo('student-1'),
    expect: 'allow',
  },
  {
    label: 'student actor',
    actor: () => AuthFixtures.student.enrolledIn('cg-6a'),
    expect: 'allow',
  },
])

describe('AcademicsOperations.programUpdate', () => {
  test('requires ACADEMIC_PROGRAM_UPDATE', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.ACADEMIC_PROGRAM_UPDATE])
    expect(() => operationModule(AcademicsOperations.programUpdate)(actor)).not.toThrow()
  })

  test('denies teachers', () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    expect(() => operationModule(AcademicsOperations.programUpdate)(actor)).toThrow(AuthorizationError)
  })
})

describeOperationMatrix(AcademicsOperations.curriculumReadScoped, [
  {
    label: 'staff with scoped curriculum read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.QUERY_CLASS_CURRICULUM_READ]),
    expect: 'allow',
  },
  {
    label: 'teacher with subject assignment',
    actor: () => AuthFixtures.teacher.subject('cs-math'),
    expect: 'allow',
    context: { classSubjectId: 'cs-math' },
  },
])

describe('AcademicsOperations.examConfigure', () => {
  test('requires EXAM_CONFIG_CONFIGURE', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.EXAM_CONFIG_CONFIGURE])
    expect(() => operationModule(AcademicsOperations.examConfigure)(actor)).not.toThrow()
  })
})

describeOperationMatrix(QueryOperations.overviewRead, [
  {
    label: 'staff with overview read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.QUERY_OVERVIEW_READ]),
    expect: 'allow',
  },
  {
    label: 'teacher denied',
    actor: () => AuthFixtures.teacher.subject('cs-math'),
    expect: 'deny',
  },
])

describe('ServiceAccountOperations', () => {
  test('create requires SERVICE_ACCOUNT_CREATE', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.SERVICE_ACCOUNT_CREATE])
    expect(() => operationModule(ServiceAccountOperations.create)(actor)).not.toThrow()
  })

  test('read requires SERVICE_ACCOUNT_READ', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.SERVICE_ACCOUNT_READ])
    expect(() => operationModule(ServiceAccountOperations.read)(actor)).not.toThrow()
  })
})
