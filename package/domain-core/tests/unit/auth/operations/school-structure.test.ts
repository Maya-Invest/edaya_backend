import { describe, expect, test } from 'bun:test'
import { operationModule } from '../../../../src/application/entities/entity-config'
import {
  AuthorizationError,
  Permission,
  SchoolStructureOperations,
  TeacherOperations,
} from '../../../../src/capabilities/authorization'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { describeOperationMatrix } from '../../../support/operation-matrix'

describeOperationMatrix(SchoolStructureOperations.configure, [
  {
    label: 'staff with structure configure',
    actor: () => AuthFixtures.staff.withPermissions([Permission.SCHOOL_STRUCTURE_CONFIGURE]),
    expect: 'allow',
  },
  {
    label: 'teacher denied',
    actor: () => AuthFixtures.teacher.subject('cs-math'),
    expect: 'deny',
  },
])

describeOperationMatrix(SchoolStructureOperations.classGroupRead, [
  {
    label: 'staff with class directory read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.QUERY_CLASS_DIRECTORY_READ]),
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
    label: 'guardian workspace shell',
    actor: () => AuthFixtures.guardian.linkedTo('student-1'),
    expect: 'allow',
  },
])

describe('TeacherOperations', () => {
  test('selfRead allows unassigned teachers', () => {
    const actor = AuthFixtures.teacher.unassigned()
    expect(() => operationModule(TeacherOperations.selfRead)(actor)).not.toThrow()
  })

  test('assignmentRead rejects unassigned teachers', () => {
    const actor = AuthFixtures.teacher.unassigned()
    expect(() => operationModule(TeacherOperations.assignmentRead)(actor)).toThrow(AuthorizationError)
  })
})

describeOperationMatrix(SchoolStructureOperations.lifecycleManage, [
  {
    label: 'staff with lifecycle manage',
    actor: () => AuthFixtures.staff.withPermissions([Permission.SCHOOL_LIFECYCLE_MANAGE]),
    expect: 'allow',
  },
  {
    label: 'teacher denied',
    actor: () => AuthFixtures.teacher.subject('cs-math'),
    expect: 'deny',
  },
])
