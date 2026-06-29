import type { FeeCategory, PaymentMethod } from '@edaya/core'

export interface FeeInstallmentSeedRecord {
  label: string
  percentage: number
  dueDate?: string
}

export interface FeeSeedRecord {
  id: string
  schoolId: string
  academicYearId: string
  name: string
  category: FeeCategory
  defaultAmount: number
  currency: string
  installments: readonly FeeInstallmentSeedRecord[]
}

export interface StudentFeeSeedRecord {
  id: string
  studentId: string
  feeId: string
  expectedAmount: number
  dueDate: string
  referenceDate: string
}

export interface PaymentSeedRecord {
  id: string
  studentFeeId: string
  amount: number
  paymentDate: string
  method: PaymentMethod
  referenceDate: string
}

export interface FinanceSeedPort {
  createFee: (record: FeeSeedRecord) => Promise<void>
  assignFeeToStudent: (record: StudentFeeSeedRecord) => Promise<void>
  recordPayment: (record: PaymentSeedRecord) => Promise<void>
}
