import type { CatalogServiceCategory, CatalogServiceStatus, PaymentMethod } from '@edaya/core'
import type { FixtureAllocationPlan } from '@edaya/fixtures'

export interface CatalogInstallmentSeedRecord {
  label: string
  percentage: number
  dueDate?: string
}

export interface CatalogServiceSeedRecord {
  id: string
  academicYearId: string
  name: string
  description?: string
  category?: CatalogServiceCategory
  defaultPrice: number
  currency: string
  billingTerms: {
    kind: 'one_time'
    installments: readonly CatalogInstallmentSeedRecord[]
    singleDueDate?: string
  }
  status?: CatalogServiceStatus
}

export interface StudentServiceEnrollmentSeedRecord {
  id: string
  studentId: string
  catalogServiceId: string
  priceOverride?: number
  dueDate?: string
}

export interface PaymentSeedRecord {
  id: string
  studentId?: string
  academicYearId?: string
  accountId?: string
  amount: number
  paymentDate: string
  method: PaymentMethod
  reference?: string
  notes?: string
  allocation?: FixtureAllocationPlan
}

export interface WaiveStudentChargeSeedRecord {
  chargeId: string
  reason: string
  waiverAmount?: number
}

export interface CancelStudentChargeSeedRecord {
  chargeId: string
  reason: string
}

export interface PaymentAllocationSeedRecord {
  id: string
  chargeId: string
  causedByPaymentId?: string
  kind: string
}

export interface ReverseAllocationSeedRecord {
  allocationId: string
}

export interface ReversePaymentSeedRecord {
  paymentId: string
  reverseAllocationIds?: readonly string[]
}

export interface RefundAvailableBalanceSeedRecord {
  id: string
  accountId: string
  amount: number
  paymentDate: string
  method: PaymentMethod
  reference?: string
  notes?: string
}

export interface FinanceSeedPort {
  createCatalogService: (record: CatalogServiceSeedRecord) => Promise<void>
  enrollStudentInService: (record: StudentServiceEnrollmentSeedRecord) => Promise<void>
  recordPayment: (record: PaymentSeedRecord) => Promise<void>
  waiveStudentCharge: (record: WaiveStudentChargeSeedRecord) => Promise<void>
  cancelStudentCharge: (record: CancelStudentChargeSeedRecord) => Promise<void>
  listPaymentAllocations: (input: { accountId: string, paymentId: string }) => Promise<readonly PaymentAllocationSeedRecord[]>
  reverseAllocation: (record: ReverseAllocationSeedRecord) => Promise<void>
  reversePayment: (record: ReversePaymentSeedRecord) => Promise<void>
  refundAvailableBalance: (record: RefundAvailableBalanceSeedRecord) => Promise<void>
}
