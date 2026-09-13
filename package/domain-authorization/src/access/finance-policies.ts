import type { Payment, StudentFee } from '@edaya/core'
import type { AccessPolicies } from './access-policies'
import { PaymentStatus, Permission } from '@edaya/core'
import { AccessFacts, denied } from './facts'

export class FinanceAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}

  overdueFeesScope() {
    return this.access.scope(Permission.QUERY_OVERDUE_FEES_READ, 'studentFees')
  }

  assertAssignFee(studentId: string) {
    return this.access.assertResources(Permission.PAYMENT_RECORD, 'students', [studentId])
  }

  assertRecordPayment(studentFeeId: string) {
    return this.assertFee(Permission.PAYMENT_RECORD, studentFeeId)
  }

  async assertChangePaymentStatus(input: { paymentId: string, status: PaymentStatus.Cancelled | PaymentStatus.Reversed }) {
    const payment = await new AccessFacts(this.access.actor, this.access.repositories).one('payments', input.paymentId)
    const action = input.status === PaymentStatus.Cancelled ? Permission.PAYMENT_CANCEL : Permission.PAYMENT_REVERSE
    await this.access.assertResources(action, 'payments', [payment.id])
    await this.assertFee(action, payment.studentFeeId)
  }

  async assertBalanceChange(payment: Payment, before: StudentFee, after: StudentFee) {
    if (payment.studentFeeId !== before.id || before.id !== after.id || before.studentId !== after.studentId)
      denied('Payment balances must retain their fee and student')
    const action = payment.status === PaymentStatus.Recorded ? Permission.PAYMENT_RECORD : payment.status === PaymentStatus.Cancelled ? Permission.PAYMENT_CANCEL : Permission.PAYMENT_REVERSE
    await this.assertFee(action, before.id)
    return this.access.assertSave(action, 'studentFees', after, before)
  }

  private async assertFee(action: Permission, studentFeeId: string) {
    const fee = await new AccessFacts(this.access.actor, this.access.repositories).one('studentFees', studentFeeId)
    await this.access.assertResources(action, 'students', [fee.studentId])
    await this.access.assertResources(action, 'studentFees', [fee.id])
  }
}
