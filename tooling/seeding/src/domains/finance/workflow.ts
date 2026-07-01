import type { FixtureDataset } from '@edaya/fixtures'
import type { FinanceSeedPort } from './port'
import { FeeCategory, PaymentMethod } from '@edaya/core'
import { resolveSeedReferenceDate } from '@edaya/fixtures/meta/dates'
import { seedDateTime } from '../../support/seed-date'

export interface DevFinanceSeedCounts {
  fees: number
  studentFees: number
  payments: number
}

export async function seedDevFinance(
  port: FinanceSeedPort,
  dataset: FixtureDataset,
): Promise<DevFinanceSeedCounts> {
  const referenceDate = seedDateTime(resolveSeedReferenceDate())
  const fees = dataset.entities.fees ?? []
  const studentFees = dataset.entities.studentFees ?? []
  const payments = dataset.entities.payments ?? []

  for (const fee of fees) {
    await port.createFee({
      id: fee.id,
      schoolId: fee.schoolId,
      academicYearId: fee.academicYearId,
      name: fee.name,
      category: fee.category ?? FeeCategory.Tuition,
      defaultAmount: fee.defaultAmount,
      currency: fee.currency,
      installments: (fee.installments ?? []).map(installment => ({
        label: installment.label,
        percentage: installment.percentage,
        dueDate: installment.dueDate ? seedDateTime(String(installment.dueDate).slice(0, 10)) : undefined,
      })),
    })
  }

  for (const studentFee of studentFees) {
    await port.assignFeeToStudent({
      id: studentFee.id,
      studentId: studentFee.studentId,
      feeId: studentFee.feeId,
      expectedAmount: studentFee.expectedAmount,
      dueDate: seedDateTime(String(studentFee.dueDate).slice(0, 10)),
      referenceDate,
    })
  }

  for (const payment of payments) {
    await port.recordPayment({
      id: payment.id,
      studentFeeId: payment.studentFeeId,
      amount: payment.amount,
      paymentDate: seedDateTime(String(payment.paymentDate).slice(0, 10)),
      method: payment.method ?? PaymentMethod.BankTransfer,
      referenceDate,
    })
  }

  return {
    fees: fees.length,
    studentFees: studentFees.length,
    payments: payments.length,
  }
}
