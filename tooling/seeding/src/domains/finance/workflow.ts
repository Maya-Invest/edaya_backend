import type { FinanceSeedPort } from './port'
import { FeeCategory, PaymentMethod } from '@edaya/core'
import {
  resolveSeedReferenceDate,
  SEED_ACADEMIC_YEAR_ID,
  SEED_CURRENCY,
  SEED_FEES,
  SEED_PAYMENTS,
  SEED_SCHOOL_ID,
  SEED_STUDENT_FEES,
} from '@edaya/dev-fixtures'
import { seedDateTime } from '../../support/seed-date'

const FEE_CATEGORY_BY_SEED = {
  tuition: FeeCategory.Tuition,
  transport: FeeCategory.Transport,
  other: FeeCategory.Other,
} as const

export interface DevFinanceSeedCounts {
  fees: number
  studentFees: number
  payments: number
}

export async function seedDevFinance(
  port: FinanceSeedPort,
): Promise<DevFinanceSeedCounts> {
  const referenceDate = seedDateTime(resolveSeedReferenceDate())

  for (const fee of SEED_FEES) {
    await port.createFee({
      id: fee.id,
      schoolId: SEED_SCHOOL_ID,
      academicYearId: SEED_ACADEMIC_YEAR_ID,
      name: fee.name,
      category: FEE_CATEGORY_BY_SEED[fee.category],
      defaultAmount: fee.defaultAmount,
      currency: SEED_CURRENCY,
      installments: fee.installments.map(installment => ({
        label: installment.label,
        percentage: installment.percentage,
        dueDate: installment.dueDate ? seedDateTime(installment.dueDate) : undefined,
      })),
    })
  }

  for (const studentFee of SEED_STUDENT_FEES) {
    await port.assignFeeToStudent({
      id: studentFee.id,
      studentId: studentFee.studentId,
      feeId: studentFee.feeId,
      expectedAmount: studentFee.total,
      dueDate: seedDateTime(studentFee.dueDate),
      referenceDate,
    })
  }

  for (const payment of SEED_PAYMENTS) {
    await port.recordPayment({
      id: payment.id,
      studentFeeId: payment.studentFeeId,
      amount: payment.amount,
      paymentDate: seedDateTime(payment.paymentDate),
      method: PaymentMethod.BankTransfer,
      referenceDate,
    })
  }

  return {
    fees: SEED_FEES.length,
    studentFees: SEED_STUDENT_FEES.length,
    payments: SEED_PAYMENTS.length,
  }
}
