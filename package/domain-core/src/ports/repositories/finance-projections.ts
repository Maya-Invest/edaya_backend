import type { ResourceAccessScope } from './resource-access-scope'

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
  reversedByPaymentId: string | null
  createdAt: string
}

export interface FinanceProjectionPort {
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
