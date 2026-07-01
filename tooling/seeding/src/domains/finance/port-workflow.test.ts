import type {
  FeeSeedRecord,
  FinanceSeedPort,
  PaymentSeedRecord,
  StudentFeeSeedRecord,
} from './port'
import { FeeCategory, PaymentMethod } from '@edaya/core'
import {
  SEED_FEES,
  SEED_PAYMENTS,
  SEED_STUDENT_FEES,
} from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevFinance } from './workflow'

describe('finance seed port workflow', () => {
  test('seeds fees, student assignments, and payments with transport-neutral dates', async () => {
    const fees: FeeSeedRecord[] = []
    const studentFees: StudentFeeSeedRecord[] = []
    const payments: PaymentSeedRecord[] = []
    const port: FinanceSeedPort = {
      createFee: async (record) => {
        fees.push(record)
      },
      assignFeeToStudent: async (record) => {
        studentFees.push(record)
      },
      recordPayment: async (record) => {
        payments.push(record)
      },
    }

    const counts = await seedDevFinance(port)

    expect(counts).toEqual({
      fees: SEED_FEES.length,
      studentFees: SEED_STUDENT_FEES.length,
      payments: SEED_PAYMENTS.length,
    })
    expect(fees.map(fee => fee.category)).toContain(FeeCategory.Tuition)
    expect(fees.map(fee => fee.category)).toContain(FeeCategory.Transport)
    expect(fees.flatMap(fee => fee.installments).filter(installment => installment.dueDate)[0]?.dueDate)
      .toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(studentFees[0]?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(payments[0]?.paymentDate).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(payments.every(payment => payment.method === PaymentMethod.BankTransfer)).toBe(true)
    expect(studentFees.every(record => record.referenceDate === studentFees[0]?.referenceDate)).toBe(true)
    expect(payments.every(record => record.referenceDate === studentFees[0]?.referenceDate)).toBe(true)
  })
})
