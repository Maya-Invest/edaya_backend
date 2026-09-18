import type { PaymentStatus, StudentCharge, StudentYearAccount } from '@edaya/core'
import type { AccessPolicies } from './access-policies'
import { Permission } from '@edaya/core'
import { AccessFacts, denied } from './facts'

export class FinanceAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}

  overdueChargesScope() {
    return this.access.scope(Permission.QUERY_OVERDUE_FEES_READ, 'studentCharges')
  }

  agingScope() {
    return this.access.scope(Permission.QUERY_OVERDUE_FEES_READ, 'studentCharges')
  }

  reconciliationScope() {
    return this.access.scope(Permission.FINANCIAL_REPORT_READ, 'studentYearAccounts')
  }

  assertEnrollStudent(studentId: string) {
    return this.access.assertResources(Permission.PAYMENT_RECORD, 'students', [studentId])
  }

  assertRecordPayment(accountId: string) {
    return this.assertAccount(Permission.PAYMENT_RECORD, accountId)
  }

  assertAllocate(accountId: string) {
    return this.assertAccount(Permission.PAYMENT_ALLOCATE, accountId)
  }

  assertReadStudent(studentId: string) {
    return this.access.assertResources(Permission.PAYMENT_READ, 'students', [studentId], 'read')
  }

  assertReadAccount(accountId: string) {
    return this.assertAccount(Permission.PAYMENT_READ, accountId, 'read')
  }

  assertReconciliation() {
    return this.access.assertSchool(Permission.FINANCIAL_REPORT_READ)
  }

  async assertReversePayment(paymentId: string) {
    const payment = await new AccessFacts(this.access.actor, this.access.repositories).one('payments', paymentId)
    await this.access.assertResources(Permission.PAYMENT_REVERSE, 'payments', [payment.id])
    await this.assertAccount(Permission.PAYMENT_REVERSE, payment.accountId)
  }

  async assertRefund(accountId: string) {
    return this.assertAccount(Permission.PAYMENT_REVERSE, accountId)
  }

  async assertBalanceChange(
    permission: Permission,
    account: StudentYearAccount,
    before: StudentYearAccount | undefined,
    charge?: StudentCharge,
  ) {
    if (before && (before.id !== account.id || before.studentId !== account.studentId))
      denied('Account identity must stay on the same student')
    await this.access.assertResources(permission, 'students', [account.studentId])
    await this.access.assertResources(permission, 'studentYearAccounts', [account.id])
    if (charge) {
      if (charge.studentId !== account.studentId || charge.academicYearId !== account.academicYearId)
        denied('Charge must belong to the same student year as the account')
      await this.access.assertResources(permission, 'studentCharges', [charge.id])
    }
    return this.access.assertSave(permission, 'studentYearAccounts', account, before)
  }

  async assertChangePaymentStatus(input: { paymentId: string, status: PaymentStatus.Reversed }) {
    return this.assertReversePayment(input.paymentId)
  }

  private async assertAccount(action: Permission, accountId: string, intent: 'read' | 'write' = 'write') {
    const account = await new AccessFacts(this.access.actor, this.access.repositories).one('studentYearAccounts', accountId)
    await this.access.assertResources(action, 'students', [account.studentId], intent)
    await this.access.assertResources(action, 'studentYearAccounts', [account.id], intent)
    return account
  }
}
