import { describe, expect, test } from 'bun:test'
import { operationModule } from '../../../../src/application/entities/entity-config'
import {
  AttachmentOperations,
  AuthorizationError,
  FinanceOperations,
  Permission,
} from '../../../../src/capabilities/authorization'
import { AuthFixtures } from '../../../support/authorization-fixtures'
import { describeOperationMatrix } from '../../../support/operation-matrix'

describe('FinanceOperations', () => {
  test('paymentsRead allows guardian with linked student context', () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    expect(() => operationModule(FinanceOperations.paymentsRead, { studentId: 'student-1' })(actor)).not.toThrow()
  })

  test('paymentRecord requires PAYMENT_RECORD permission', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.PAYMENT_RECORD])
    expect(() => operationModule(FinanceOperations.paymentRecord, { studentId: 'student-1' })(actor)).not.toThrow()
  })

  test('paymentCancel requires PAYMENT_CANCEL permission', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.PAYMENT_CANCEL])
    expect(() => operationModule(FinanceOperations.paymentCancel, { studentId: 'student-1' })(actor)).not.toThrow()
  })
})

describeOperationMatrix(FinanceOperations.feeCatalogRead, [
  {
    label: 'staff with financial config read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.FINANCIAL_CONFIG_READ]),
    expect: 'allow',
  },
  {
    label: 'staff with payment read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.PAYMENT_READ]),
    expect: 'allow',
  },
  {
    label: 'guardian read payments',
    actor: () => AuthFixtures.guardian.linkedTo('student-1'),
    expect: 'allow',
  },
])

describeOperationMatrix(FinanceOperations.paymentsRead, [
  {
    label: 'staff with payment read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.PAYMENT_READ]),
    expect: 'allow',
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

describe('AttachmentOperations', () => {
  test('attachments.read allows assigned teachers', () => {
    const actor = AuthFixtures.teacher.subject('cs-math')
    expect(() => operationModule(AttachmentOperations.read)(actor)).not.toThrow()
  })

  test('attachments.read rejects unassigned teachers', () => {
    const actor = AuthFixtures.teacher.unassigned()
    expect(() => operationModule(AttachmentOperations.read)(actor)).toThrow(AuthorizationError)
  })

  test('attachments.configure requires ATTACHMENT_CONFIGURE', () => {
    const actor = AuthFixtures.staff.withPermissions([Permission.ATTACHMENT_CONFIGURE])
    expect(() => operationModule(AttachmentOperations.configure)(actor)).not.toThrow()
  })
})

describeOperationMatrix(AttachmentOperations.read, [
  {
    label: 'staff with attachment read',
    actor: () => AuthFixtures.staff.withPermissions([Permission.ATTACHMENT_READ]),
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
