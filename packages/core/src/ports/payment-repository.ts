import type { Payment } from '$lib/core/entities/finances/payment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface PaymentRepository extends BaseRepositoryInterface<Payment> {
  listByStudentFee: (studentFeeId: string) => Promise<Payment[]>
}
