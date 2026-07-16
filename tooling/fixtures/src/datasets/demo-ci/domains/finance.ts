import type { FeeInput, PaymentInput, StudentFeeInput } from '@edaya/core'
import { FeeCategory, FeeStatus, PaymentMethod } from '@edaya/core'
import { DEMO_CI_ACADEMIC_YEAR_ID, DEMO_CI_SCHOOL_ID } from '../../../shared/ids'

export const demoCiFees = [
  {
    id: 'ci-f1',
    schoolId: DEMO_CI_SCHOOL_ID,
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    name: 'Scolarité — Collège',
    category: FeeCategory.Tuition,
    defaultAmount: 450_000,
    currency: 'XOF',
    installments: [
      { label: 'Septembre', percentage: 33.33, dueDate: '2025-09-15T12:00:00.000Z' },
      { label: 'Janvier', percentage: 33.33, dueDate: '2026-01-15T12:00:00.000Z' },
      { label: 'Mai', percentage: 33.34, dueDate: '2026-05-15T12:00:00.000Z' },
    ],
  },
  {
    id: 'ci-f2',
    schoolId: DEMO_CI_SCHOOL_ID,
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    name: 'Transport scolaire',
    category: FeeCategory.Transport,
    defaultAmount: 75_000,
    currency: 'XOF',
    installments: [{ label: 'Annuel', percentage: 100, dueDate: '2025-09-15T12:00:00.000Z' }],
  },
  {
    id: 'ci-f3',
    schoolId: DEMO_CI_SCHOOL_ID,
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    name: 'Cantine',
    category: FeeCategory.Other,
    defaultAmount: 18_000,
    currency: 'XOF',
    installments: [],
  },
  {
    id: 'ci-f4',
    schoolId: DEMO_CI_SCHOOL_ID,
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    name: 'Club sportif',
    category: FeeCategory.Other,
    defaultAmount: 25_000,
    currency: 'XOF',
    installments: [{ label: 'Trimestre', percentage: 100, dueDate: '2026-01-15T12:00:00.000Z' }],
  },
  {
    id: 'ci-f5',
    schoolId: DEMO_CI_SCHOOL_ID,
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    name: 'Fournitures scolaires',
    category: FeeCategory.Other,
    defaultAmount: 15_000,
    currency: 'XOF',
    installments: [{ label: 'Annuel', percentage: 100, dueDate: '2025-09-15T12:00:00.000Z' }],
  },
] as const satisfies readonly FeeInput[]

export const demoCiStudentFees = [
  { id: 'ci-b1', studentId: 'ci-s1', feeId: 'ci-f1', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, expectedAmount: 450_000, paidAmount: 300_000, currency: 'XOF', dueDate: '2026-05-30T12:00:00.000Z', status: FeeStatus.Overdue },
  { id: 'ci-b2', studentId: 'ci-s2', feeId: 'ci-f1', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, expectedAmount: 450_000, paidAmount: 300_000, currency: 'XOF', dueDate: '2026-05-30T12:00:00.000Z', status: FeeStatus.Overdue },
  { id: 'ci-b3', studentId: 'ci-s3', feeId: 'ci-f1', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, expectedAmount: 450_000, paidAmount: 150_000, currency: 'XOF', dueDate: '2026-04-15T12:00:00.000Z', status: FeeStatus.Overdue },
  { id: 'ci-b4', studentId: 'ci-s4', feeId: 'ci-f2', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, expectedAmount: 75_000, paidAmount: 0, currency: 'XOF', dueDate: '2025-09-30T12:00:00.000Z', status: FeeStatus.Overdue },
  { id: 'ci-b5', studentId: 'ci-s5', feeId: 'ci-f1', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, expectedAmount: 450_000, paidAmount: 450_000, currency: 'XOF', dueDate: '2026-05-30T12:00:00.000Z', status: FeeStatus.Paid },
  { id: 'ci-b6', studentId: 'ci-s6', feeId: 'ci-f3', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, expectedAmount: 162_000, paidAmount: 90_000, currency: 'XOF', dueDate: '2026-06-01T12:00:00.000Z', status: FeeStatus.Overdue },
  { id: 'ci-b7', studentId: 'ci-s11', feeId: 'ci-f4', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, expectedAmount: 25_000, paidAmount: 0, currency: 'XOF', dueDate: '2026-06-18T12:00:00.000Z', status: FeeStatus.Pending },
  { id: 'ci-b8', studentId: 'ci-s12', feeId: 'ci-f5', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, expectedAmount: 15_000, paidAmount: 0, currency: 'XOF', dueDate: '2026-06-20T12:00:00.000Z', status: FeeStatus.Pending },
  { id: 'ci-b9', studentId: 'ci-s17', feeId: 'ci-f1', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, expectedAmount: 450_000, paidAmount: 150_000, currency: 'XOF', dueDate: '2026-05-30T12:00:00.000Z', status: FeeStatus.Overdue },
  { id: 'ci-b10', studentId: 'ci-s22', feeId: 'ci-f1', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, expectedAmount: 450_000, paidAmount: 150_000, currency: 'XOF', dueDate: '2026-05-30T12:00:00.000Z', status: FeeStatus.Overdue },
  { id: 'ci-b11', studentId: 'ci-s25', feeId: 'ci-f1', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, expectedAmount: 450_000, paidAmount: 0, currency: 'XOF', dueDate: '2026-06-15T12:00:00.000Z', status: FeeStatus.Overdue },
] as const satisfies readonly StudentFeeInput[]

export const demoCiPayments = [
  { id: 'ci-pay-b1-1', studentFeeId: 'ci-b1', amount: 150_000, currency: 'XOF', paymentDate: '2025-09-15T12:00:00.000Z', method: PaymentMethod.BankTransfer },
  { id: 'ci-pay-b1-2', studentFeeId: 'ci-b1', amount: 150_000, currency: 'XOF', paymentDate: '2026-01-15T12:00:00.000Z', method: PaymentMethod.BankTransfer },
  { id: 'ci-pay-b2-1', studentFeeId: 'ci-b2', amount: 150_000, currency: 'XOF', paymentDate: '2025-09-15T12:00:00.000Z', method: PaymentMethod.BankTransfer },
  { id: 'ci-pay-b2-2', studentFeeId: 'ci-b2', amount: 150_000, currency: 'XOF', paymentDate: '2026-01-15T12:00:00.000Z', method: PaymentMethod.BankTransfer },
  { id: 'ci-pay-b3-1', studentFeeId: 'ci-b3', amount: 150_000, currency: 'XOF', paymentDate: '2025-09-15T12:00:00.000Z', method: PaymentMethod.BankTransfer },
  { id: 'ci-pay-b5-1', studentFeeId: 'ci-b5', amount: 450_000, currency: 'XOF', paymentDate: '2025-09-15T12:00:00.000Z', method: PaymentMethod.BankTransfer },
  { id: 'ci-pay-b6-1', studentFeeId: 'ci-b6', amount: 18_000, currency: 'XOF', paymentDate: '2025-10-01T12:00:00.000Z', method: PaymentMethod.Cash },
  { id: 'ci-pay-b6-2', studentFeeId: 'ci-b6', amount: 18_000, currency: 'XOF', paymentDate: '2025-11-01T12:00:00.000Z', method: PaymentMethod.Cash },
  { id: 'ci-pay-b6-3', studentFeeId: 'ci-b6', amount: 18_000, currency: 'XOF', paymentDate: '2025-12-01T12:00:00.000Z', method: PaymentMethod.Cash },
  { id: 'ci-pay-b6-4', studentFeeId: 'ci-b6', amount: 18_000, currency: 'XOF', paymentDate: '2026-01-01T12:00:00.000Z', method: PaymentMethod.Cash },
  { id: 'ci-pay-b6-5', studentFeeId: 'ci-b6', amount: 18_000, currency: 'XOF', paymentDate: '2026-02-01T12:00:00.000Z', method: PaymentMethod.Cash },
  { id: 'ci-pay-b9-1', studentFeeId: 'ci-b9', amount: 150_000, currency: 'XOF', paymentDate: '2025-09-15T12:00:00.000Z', method: PaymentMethod.BankTransfer },
  { id: 'ci-pay-b10-1', studentFeeId: 'ci-b10', amount: 150_000, currency: 'XOF', paymentDate: '2025-09-15T12:00:00.000Z', method: PaymentMethod.BankTransfer },
] as const satisfies readonly PaymentInput[]
