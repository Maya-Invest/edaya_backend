import { z } from 'zod'
import { parseDomain, zodDate } from '../../domain/shared/utils'

export const dateTimeRangeBaseSchema = z.object({
  startsAt: zodDate(),
  endsAt: zodDate(),
})

export function refineEndsAtAfterStartsAt(
  data: { startsAt: Date, endsAt: Date },
  ctx: z.RefinementCtx,
) {
  if (data.endsAt.getTime() <= data.startsAt.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endsAt must be after startsAt',
      path: ['endsAt'],
    })
  }
}

export function refineEndsAtNotBeforeStartsAtOptional(
  data: { startsAt?: Date, endsAt?: Date },
  ctx: z.RefinementCtx,
) {
  if (data.startsAt && data.endsAt && data.endsAt.getTime() < data.startsAt.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endsAt must not be before startsAt',
      path: ['endsAt'],
    })
  }
}

export const dateTimeRangeSchema = dateTimeRangeBaseSchema.superRefine(refineEndsAtAfterStartsAt)

export type DateTimeRangeData = z.infer<typeof dateTimeRangeSchema>
export type DateTimeRangeInput = z.input<typeof dateTimeRangeBaseSchema>

export function dateTimeRangeDurationMinutes(startsAt: Date, endsAt: Date): number {
  return Math.round((endsAt.getTime() - startsAt.getTime()) / 60000)
}

export function dateTimeRangeContains(startsAt: Date, endsAt: Date, value: Date): boolean {
  return value.getTime() >= startsAt.getTime() && value.getTime() <= endsAt.getTime()
}

export function dateTimeRangeOverlaps(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
): boolean {
  return leftStart.getTime() < rightEnd.getTime() && rightStart.getTime() < leftEnd.getTime()
}

/**
 * A concrete date-time window with strict ordering (end must be after start).
 */
export class DateTimeRange {
  readonly startsAt: Date
  readonly endsAt: Date

  constructor(input: DateTimeRangeInput) {
    const data = parseDomain(dateTimeRangeSchema, input)
    this.startsAt = data.startsAt
    this.endsAt = data.endsAt
  }

  get durationMinutes(): number {
    return dateTimeRangeDurationMinutes(this.startsAt, this.endsAt)
  }

  contains(value: Date): boolean {
    return dateTimeRangeContains(this.startsAt, this.endsAt, value)
  }

  overlaps(other: DateTimeRange): boolean {
    return dateTimeRangeOverlaps(this.startsAt, this.endsAt, other.startsAt, other.endsAt)
  }
}
