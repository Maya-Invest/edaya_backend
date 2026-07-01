import { z } from 'zod'
import { parseDomain } from '../../domain/shared/utils'
import { Money, moneySchema } from './money'

export const studentFeeSummarySchema = z.object({
  totalExpected: moneySchema,
  totalPaid: moneySchema,
  totalOverdue: moneySchema,
  totalAdjusted: moneySchema.optional(),
  itemCount: z.number().int().nonnegative('itemCount must be a non-negative integer'),
})

export type StudentFeeSummaryData = z.infer<typeof studentFeeSummarySchema>
export type StudentFeeSummaryInput = z.input<typeof studentFeeSummarySchema>

/**
 * Aggregated fee totals for a student across multiple fee assignments.
 */
export class StudentFeeSummary {
  readonly totalExpected: Money
  readonly totalPaid: Money
  readonly totalOverdue: Money
  readonly totalAdjusted: Money
  readonly balanceDue: Money
  readonly itemCount: number

  constructor(input: StudentFeeSummaryInput) {
    const data = parseDomain(studentFeeSummarySchema, input)
    this.totalExpected = new Money(data.totalExpected)
    this.totalPaid = new Money(data.totalPaid)
    this.totalOverdue = new Money(data.totalOverdue)
    this.totalAdjusted = data.totalAdjusted
      ? new Money(data.totalAdjusted)
      : new Money({ amount: 0, currency: data.totalExpected.currency })
    this.balanceDue = new Money({
      amount: Math.max(0, this.totalExpected.amount - this.totalAdjusted.amount - this.totalPaid.amount),
      currency: this.totalExpected.currency,
    })
    this.itemCount = data.itemCount
  }
}
