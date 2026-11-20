import type { ResourceAccessScope } from './resource-access-scope'
import { z } from 'zod'
import { PaymentKind, PaymentMethod, PaymentStatus } from '../../domain/finances/payment'

export const guardianPaymentQuery = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  paymentId: z.string().min(1),
})
export const guardianPaymentDetail = z.object({
  payment: z.object({
    id: z.string(),
    kind: z.nativeEnum(PaymentKind),
    amount: z.number().int(),
    currency: z.string(),
    paymentDate: z.string().datetime(),
    method: z.nativeEnum(PaymentMethod),
    status: z.nativeEnum(PaymentStatus),
    reference: z.string().nullable(),
    chargeLabels: z.array(z.string()),
  }).nullable(),
})
export type GuardianPaymentInput = z.infer<typeof guardianPaymentQuery>

export const guardianFeesQuery = guardianPaymentQuery.omit({ paymentId: true })
export const guardianSettlementQuery = guardianFeesQuery.extend({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
})
const financeContext = guardianFeesQuery.extend({ accountId: z.string().nullable(), currency: z.string() })
export const guardianFeesSummary = financeContext.extend({
  available: z.number().int(),
  outstanding: z.number().int(),
  overdue: z.number().int(),
  expected: z.number().int(),
  paid: z.number().int(),
  overdueCount: z.number().int(),
})
export const guardianSettlementPage = financeContext.extend({
  payments: guardianPaymentDetail.shape.payment.unwrap().array(),
  charges: z.array(z.object({
    id: z.string(),
    label: z.string(),
    currency: z.string(),
    status: z.string(),
    dueDate: z.string().datetime().nullable(),
    expectedAmount: z.number().int(),
    allocatedAmount: z.number().int(),
    adjustmentAmount: z.number().int(),
    waiverAmount: z.number().int(),
    settlementCount: z.number().int().nonnegative(),
  })),
  nextPaymentCursor: z.string().nullable(),
  nextChargeCursor: z.string().nullable(),
})
export type GuardianFeesInput = z.infer<typeof guardianFeesQuery>
export type GuardianSettlementInput = z.infer<typeof guardianSettlementQuery>
export interface SettlementBoundary {
  section: 'payments' | 'charges'
  accountId: string | null
  date: string | null
  label: string
  id: string
}

export interface SchoolFinanceAging {
  schoolId: string
  academicYearId?: string
  currency: string
  overdueCount: number
  overdueAmount: number
  outstandingAmount: number
  charges: Array<{
    chargeId: string
    studentId: string
    label: string
    overdueAmount: number
    remainingAmount: number
    dueDate?: string
  }>
}

export interface FinanceOverview {
  schoolId: string
  academicYearId: string
  currency: string
  scope: 'authorized'
  received: number
  refunded: number
  netCollected: number
  outstanding: number
  overdue: number
  overdueStudents: number
  availableCredit: number
  studentsAssigned: number
  netBilled: number
  applied: number
}

export interface FinanceReadInput {
  paymentId?: string
  dueFrom?: string
  dueTo?: string
  schoolId: string
  academicYearId: string
  currency: string
  referenceDate: Date
  feeId?: string
  chargeId?: string
  studentId?: string
  search?: string
  classGroupId?: string
  status?: string
  due?: 'overdue' | 'outstanding'
  sort?: 'student' | 'label' | 'net' | 'applied' | 'remaining' | 'dueDate' | 'status' | 'paymentDate' | 'amount'
  direction?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export interface FinanceReadScopes {
  charges: ResourceAccessScope
  accounts: ResourceAccessScope
  payments: ResourceAccessScope
}

/** Read DTOs contain captured charge facts, not mutable catalog defaults. */
export interface FinanceBillingRow {
  classId: string | null
  id: string
  schoolId: string
  academicYearId: string
  studentId: string
  studentName: string
  enrollmentId: string
  catalogServiceId: string
  label: string
  expectedAmount: number
  adjustmentAmount: number
  waiverAmount: number
  allocatedAmount: number
  netAmount: number
  remaining: number
  overdue: number
  currency: string
  status: string
  dueDate: string | null
  createdAt: string
  adjustmentReason: string | null
  adjustedAt: string | null
  adjustedById: string | null
  waiverReason: string | null
  waivedAt: string | null
  waivedById: string | null
  cancellationReason: string | null
  cancelledAt: string | null
  cancelledById: string | null
  installments: { id: string, label: string, expectedAmount: number, dueDate?: string | null }[]
  accountId: string | null
  availableCredit: number
}

export interface FinancePaymentRow {
  classId: string | null
  hasActiveAllocations: boolean
  id: string
  schoolId: string
  academicYearId: string
  accountId: string
  studentId: string
  studentName: string
  kind: string
  amount: number
  currency: string
  paymentDate: string
  method: string
  status: string
  reference: string | null
  notes: string | null
  recordedById: string | null
  reversedAt: string | null
  reversedById: string | null
  reversesPaymentId: string | null
  reversedByPaymentId: string | null
  createdAt: string
}

export interface FinanceProjectionPort {
  guardianFeesSummary: (input: GuardianFeesInput, currency: string, scopes: Pick<FinanceReadScopes, 'accounts' | 'charges'>, at: Date) => Promise<z.infer<typeof guardianFeesSummary>>
  guardianSettlements: (input: GuardianSettlementInput, currency: string, scopes: FinanceReadScopes, after?: SettlementBoundary) => Promise<z.infer<typeof guardianSettlementPage>>
  guardianPayment: (input: GuardianPaymentInput, schoolCurrency: string, scopes: FinanceReadScopes) => Promise<z.infer<typeof guardianPaymentDetail>>
  overview: (input: FinanceReadInput, scopes: FinanceReadScopes) => Promise<FinanceOverview>
  billingPage: (input: FinanceReadInput, scopes: FinanceReadScopes) => Promise<{ rows: FinanceBillingRow[], total: number }>
  paymentsPage: (input: FinanceReadInput, scopes: FinanceReadScopes) => Promise<{ rows: FinancePaymentRow[], total: number }>

  aging: (input: { schoolId: string, academicYearId?: string, currency: string, referenceDate: Date }, scope: ResourceAccessScope) => Promise<SchoolFinanceAging>
}

export interface FinanceReconciliation {
  schoolId: string
  academicYearId?: string
  accounts: Array<{
    accountId: string
    studentId: string
    projectedAvailable: number
    entrySum: number
    difference: number
  }>
  charges: Array<{
    chargeId: string
    studentId: string
    projectedAllocated: number
    settlement: number
    difference: number
  }>
  balanced: boolean
}
