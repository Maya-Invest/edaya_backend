import { describe, expect, test } from 'bun:test'
import { operationModule } from '../../../../src/application/entities/entity-config'
import {
  AccessControlOperations,
  AuthorizationError,
  CommunicationsOperations,
  Permission,
  WorkspaceOperations,
} from '../../../../src/capabilities/authorization'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { describeOperationMatrix } from '../../../support/operation-matrix'

describeOperationMatrix(WorkspaceOperations.read, [
  {
    label: 'staff with workspace read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.QUERY_WORKSPACE_READ]),
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
  {
    label: 'student workspace shell',
    actor: () => AuthFixtures.student.enrolledIn('class-1'),
    expect: 'allow',
  },
])

describe('CommunicationsOperations', () => {
  test('communications.create requires COMMUNICATION_CREATE', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.COMMUNICATION_CREATE])
    expect(() => operationModule(CommunicationsOperations.create)(actor)).not.toThrow()
  })

  test('communications.create denies guardians', () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    expect(() => operationModule(CommunicationsOperations.create)(actor)).toThrow(AuthorizationError)
  })
})

describeOperationMatrix(CommunicationsOperations.read, [
  {
    label: 'staff with communications read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.QUERY_COMMUNICATIONS_READ]),
    expect: 'allow',
  },
  {
    label: 'guardian read communications',
    actor: () => AuthFixtures.guardian.linkedTo('student-1'),
    expect: 'allow',
  },
  {
    label: 'student read communications',
    actor: () => AuthFixtures.student.enrolledIn('class-1'),
    expect: 'allow',
  },
])

describeOperationMatrix(AccessControlOperations.assign, [
  {
    label: 'staff with access control assign',
    actor: () => AuthFixtures.staff.withPermissions([Permission.ACCESS_CONTROL_ASSIGN]),
    expect: 'allow',
  },
  {
    label: 'teacher denied',
    actor: () => AuthFixtures.teacher.subject('cs-math'),
    expect: 'deny',
  },
  {
    label: 'guardian denied',
    actor: () => AuthFixtures.guardian.linkedTo('student-1'),
    expect: 'deny',
  },
])
