import type { Allocation } from './allocation'
import type { CatalogInstallmentTemplate } from './catalog-service'
import type { StudentAccountEntry } from './student-account-entry'
import type { ChargeInstallment, StudentCharge } from './student-charge'
import { Money } from '../../domain/value-objects/money'
import { AllocationKind } from './allocation'
import { AccountEntryDirection } from './student-account-entry'
import { ChargeStatus } from './student-charge'

export const FINANCE_BATCH_ENROLL_LIMIT = 100

export function oneTimeChargeId(enrollmentId: string): string {
  return enrollmentId
}

export function compareChargesForFifo(left: StudentCharge, right: StudentCharge): number {
  const leftDated = left.dueDate ? 0 : 1
  const rightDated = right.dueDate ? 0 : 1
  if (leftDated !== rightDated)
    return leftDated - rightDated
  if (left.dueDate && right.dueDate) {
    const due = left.dueDate.getTime() - right.dueDate.getTime()
    if (due !== 0)
      return due
  }
  const created = left.createdAt.getTime() - right.createdAt.getTime()
  if (created !== 0)
    return created
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

export function compareInstallmentsForAttribution(left: ChargeInstallment, right: ChargeInstallment): number {
  const leftDated = left.dueDate ? 0 : 1
  const rightDated = right.dueDate ? 0 : 1
  if (leftDated !== rightDated)
    return leftDated - rightDated
  if (left.dueDate && right.dueDate) {
    const due = left.dueDate.getTime() - right.dueDate.getTime()
    if (due !== 0)
      return due
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

export function reversedAllocationIds(allocations: readonly Allocation[]): Set<string> {
  const ids = new Set<string>()
  for (const allocation of allocations) {
    if (allocation.kind === AllocationKind.Reverse && allocation.reversesAllocationId)
      ids.add(allocation.reversesAllocationId)
  }
  return ids
}

export function netActiveSettlement(allocations: readonly Allocation[], chargeId: string): number {
  const reversed = reversedAllocationIds(allocations)
  return allocations
    .filter(allocation => allocation.chargeId === chargeId && allocation.kind === AllocationKind.Settle && !reversed.has(allocation.id))
    .reduce((sum, allocation) => sum + allocation.amount.amount, 0)
}

export function isAllocationActive(allocation: Allocation, allocations: readonly Allocation[]): boolean {
  if (allocation.kind !== AllocationKind.Settle)
    return false
  return !reversedAllocationIds(allocations).has(allocation.id)
}

export interface InstallmentRemainder {
  readonly installment: ChargeInstallment
  readonly settledAmount: number
  readonly remainder: number
  readonly overdue: boolean
}

export function attributeSettlementToInstallments(
  installments: readonly ChargeInstallment[],
  settlement: number,
  referenceDate: Date,
): readonly InstallmentRemainder[] {
  let remaining = settlement
  return [...installments].sort(compareInstallmentsForAttribution).map((installment) => {
    const settledAmount = Math.min(remaining, installment.expectedAmount)
    remaining -= settledAmount
    const remainder = installment.expectedAmount - settledAmount
    const overdue = remainder > 0 && !!installment.dueDate && installment.dueDate.getTime() < referenceDate.getTime()
    return { installment, settledAmount, remainder, overdue }
  })
}

export function overdueInstallmentRemainder(
  charge: StudentCharge,
  settlement: number,
  referenceDate: Date,
): number {
  if (charge.status === ChargeStatus.Cancelled)
    return 0
  const schedule = charge.installments.length > 0
    ? charge.installments
    : [{
        id: `${charge.id}-due`,
        label: charge.label,
        expectedAmount: charge.netObligation.amount,
        dueDate: charge.dueDate,
      }]
  const attributed = attributeSettlementToInstallments(schedule, settlement, referenceDate)
  return attributed.reduce((sum, item) => sum + (item.overdue ? item.remainder : 0), 0)
}

export function deriveChargeStatus(input: {
  cancelled: boolean
  expectedAmount: number
  adjustmentAmount: number
  waiverAmount: number
  settlement: number
  overdueRemainder: number
}): ChargeStatus {
  if (input.cancelled)
    return ChargeStatus.Cancelled
  const remaining = Math.max(0, input.expectedAmount - input.adjustmentAmount - input.waiverAmount - input.settlement)
  if (remaining === 0) {
    if (input.waiverAmount > 0 && input.settlement === 0)
      return ChargeStatus.Waived
    return ChargeStatus.Paid
  }
  if (input.overdueRemainder > 0)
    return ChargeStatus.Overdue
  if (input.settlement > 0)
    return ChargeStatus.Partial
  return ChargeStatus.Pending
}

export function projectCharge(charge: StudentCharge, allocations: readonly Allocation[], referenceDate: Date): StudentCharge {
  const settlement = netActiveSettlement(allocations, charge.id)
  const overdueRemainder = overdueInstallmentRemainder(charge.copyWith({ allocatedAmount: settlement }), settlement, referenceDate)
  const status = deriveChargeStatus({
    cancelled: !!charge.cancelledAt,
    expectedAmount: charge.expectedAmount.amount,
    adjustmentAmount: charge.adjustmentAmount.amount,
    waiverAmount: charge.waiverAmount.amount,
    settlement,
    overdueRemainder,
  })
  return charge.copyWith({
    allocatedAmount: settlement,
    status,
    updatedAt: charge.updatedAt,
  })
}

export function remainingChargeObligation(charge: StudentCharge, settlement = charge.allocatedAmount.amount): number {
  if (charge.cancelledAt)
    return 0
  return Math.max(0, charge.expectedAmount.amount - charge.adjustmentAmount.amount - charge.waiverAmount.amount - settlement)
}

export function materializeInstallments(
  chargeId: string,
  amount: number,
  templates: readonly CatalogInstallmentTemplate[],
  fallbackDueDate?: Date,
): ChargeInstallment[] {
  if (templates.length === 0) {
    return [{
      id: `${chargeId}-installment-1`,
      label: 'Due',
      expectedAmount: amount,
      dueDate: fallbackDueDate,
    }]
  }
  let assignedAmount = 0
  return templates.map((template, index) => {
    const isLast = index === templates.length - 1
    const expectedAmount = isLast
      ? amount - assignedAmount
      : Math.round((amount * template.percentage) / 100)
    assignedAmount += expectedAmount
    return {
      id: `${chargeId}-installment-${index + 1}`,
      label: template.label,
      expectedAmount,
      dueDate: template.dueDate ?? fallbackDueDate,
    }
  })
}

export function sumEntryBalance(entries: readonly StudentAccountEntry[]): number {
  return entries.reduce((sum, entry) => {
    return sum + (entry.direction === AccountEntryDirection.Credit ? entry.amount.amount : -entry.amount.amount)
  }, 0)
}

export function assertSameCurrency(left: string, right: string): void {
  if (left !== right)
    throw Object.assign(new Error('CURRENCY_MISMATCH'), { code: 'CURRENCY_MISMATCH' })
}

export function money(amount: number, currency: string): Money {
  return new Money({ amount, currency })
}
