import { z } from 'zod'

import { parseDomain } from '../../domain/shared/utils'
import { Money, moneySchema } from '../value-objects/money'

export const studentFinanceSummarySchema = z.object({
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  accountId: z.string().trim().min(1, 'accountId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  currency: z.string().trim().min(1, 'currency must not be blank'),
  available: moneySchema,
  outstanding: moneySchema,
  overdue: moneySchema,
})

export type StudentFinanceSummaryData = z.infer<typeof studentFinanceSummarySchema>
export type StudentFinanceSummaryInput = z.input<typeof studentFinanceSummarySchema>

export class StudentFinanceSummary {
  readonly studentId: string
  readonly academicYearId: string
  readonly accountId?: string
  readonly currency: string
  readonly available: Money
  readonly outstanding: Money
  readonly overdue: Money

  constructor(input: StudentFinanceSummaryInput) {
    const data = parseDomain(studentFinanceSummarySchema, input)
    this.studentId = data.studentId
    this.academicYearId = data.academicYearId
    this.accountId = data.accountId
    this.currency = data.currency
    this.available = new Money(data.available)
    this.outstanding = new Money(data.outstanding)
    this.overdue = new Money(data.overdue)
  }
}
