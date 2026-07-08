import { z } from 'zod'

import { parseDomain } from '../../domain/shared/utils'

import { timeOfDayToMinutes, zodTimeOfDay } from './time-of-day'

export const timeRangeBaseSchema = z.object({
  startTime: zodTimeOfDay('startTime'),
  endTime: zodTimeOfDay('endTime'),
})

export function refineTimeRangeStrictAfter(
  data: { startTime: string, endTime: string },
  ctx: z.RefinementCtx,
) {
  if (data.startTime >= data.endTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endTime must be after startTime',
      path: ['endTime'],
    })
  }
}

export const timeRangeSchema = timeRangeBaseSchema.superRefine(refineTimeRangeStrictAfter)

export type TimeRangeData = z.infer<typeof timeRangeSchema>
export type TimeRangeInput = z.input<typeof timeRangeBaseSchema>

export function timeRangeDurationMinutes(startTime: string, endTime: string): number {
  return timeOfDayToMinutes(endTime) - timeOfDayToMinutes(startTime)
}

/**
 * A same-day time window expressed as HH:mm boundaries.
 */
export class TimeRange {
  readonly startTime: string
  readonly endTime: string

  constructor(input: TimeRangeInput) {
    const data = parseDomain(timeRangeSchema, input)
    this.startTime = data.startTime
    this.endTime = data.endTime
  }

  get durationMinutes(): number {
    return timeRangeDurationMinutes(this.startTime, this.endTime)
  }
}
