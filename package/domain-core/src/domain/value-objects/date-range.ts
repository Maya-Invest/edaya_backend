import { z } from 'zod'
import { parseDomain, zodDate } from '../../domain/shared/utils'

export const dateRangeBaseSchema = z.object({
  startDate: zodDate(),
  endDate: zodDate(),
})

export function refineEndDateNotBeforeStartDate(
  data: { startDate: Date, endDate: Date },
  ctx: z.RefinementCtx,
) {
  if (data.endDate.getTime() < data.startDate.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endDate must not be before startDate',
      path: ['endDate'],
    })
  }
}

export function refineEndDateNotBeforeStartDatePartial(
  data: Partial<{ startDate: Date, endDate: Date }>,
  ctx: z.RefinementCtx,
) {
  if (data.startDate && data.endDate && data.endDate.getTime() < data.startDate.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endDate must not be before startDate',
      path: ['endDate'],
    })
  }
}

export const dateRangeSchema = dateRangeBaseSchema.superRefine(refineEndDateNotBeforeStartDate)

export type DateRangeData = z.infer<typeof dateRangeSchema>
export type DateRangeInput = z.input<typeof dateRangeBaseSchema>

const MS_PER_DAY = 86_400_000

export function dateRangeContains(startDate: Date, endDate: Date, value: Date): boolean {
  return value.getTime() >= startDate.getTime() && value.getTime() <= endDate.getTime()
}

export function dateRangeOverlaps(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
): boolean {
  return leftStart.getTime() <= rightEnd.getTime() && rightStart.getTime() <= leftEnd.getTime()
}

export function dateRangeDurationDays(startDate: Date, endDate: Date): number {
  return Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1
}

/**
 * An inclusive calendar-date window (start and end are both part of the range).
 */
export class DateRange {
  readonly startDate: Date
  readonly endDate: Date

  constructor(input: DateRangeInput) {
    const data = parseDomain(dateRangeSchema, input)
    this.startDate = data.startDate
    this.endDate = data.endDate
  }

  contains(value: Date): boolean {
    return dateRangeContains(this.startDate, this.endDate, value)
  }

  overlaps(other: DateRange): boolean {
    return dateRangeOverlaps(this.startDate, this.endDate, other.startDate, other.endDate)
  }

  get durationDays(): number {
    return dateRangeDurationDays(this.startDate, this.endDate)
  }
}
