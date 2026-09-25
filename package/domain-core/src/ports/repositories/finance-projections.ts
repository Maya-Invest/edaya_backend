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

export interface FinanceProjectionPort {
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
