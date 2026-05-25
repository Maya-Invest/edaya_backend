import type { Payment } from '../entities/finances/payment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface PaymentRepository extends BaseRepositoryInterface<Payment> {
  listByStudentFee: (studentFeeId: string) => Promise<Payment[]>
}
