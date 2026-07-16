import { z } from 'zod'

import { zodTimeOfDay } from '../../domain/value-objects/time-of-day'

import { refineTimeRangeStrictAfter, timeRangeDurationMinutes } from '../../domain/value-objects/time-range'

import { parseDomain, zodDate } from '../shared/utils'
import { DayOfWeek } from './schedule'

export const periodDefinitionBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  label: z.string().trim().min(1, 'label must not be blank'),
  dayOfWeek: z.nativeEnum(DayOfWeek),
  order: z.number().int().positive('order must be a strictly positive integer'),
  startTime: zodTimeOfDay('startTime'),
  endTime: zodTimeOfDay('endTime'),
  isBreak: z.boolean().default(false),
  isTeachingSlot: z.boolean().default(true),
  createdAt: zodDate().default(() => new Date()),
})

function refinePeriodDefinition(data: { startTime?: string, endTime?: string }, ctx: z.RefinementCtx) {
  if (data.startTime && data.endTime) {
    refineTimeRangeStrictAfter({ startTime: data.startTime, endTime: data.endTime }, ctx)
  }
}

export const periodDefinitionSchema = periodDefinitionBaseSchema.superRefine(refinePeriodDefinition)

export type PeriodDefinitionData = z.infer<typeof periodDefinitionSchema>
export type PeriodDefinitionInput = z.input<typeof periodDefinitionSchema>

export const periodDefinitionCreateSchema = periodDefinitionBaseSchema.omit({ createdAt: true }).superRefine(refinePeriodDefinition)
export const periodDefinitionUpdateSchema = periodDefinitionBaseSchema.partial().required({ id: true }).superRefine(refinePeriodDefinition)

/**
 * Defines one slot in the school's daily period grid (e.g., "Period 1: 08:00–08:45").
 * All classGroups share the same grid for a given academic year.
 * Break periods (recess, lunch) are flagged and excluded from teaching slots.
 */
export class PeriodDefinition {
  readonly data: PeriodDefinitionData

  constructor(args: PeriodDefinitionInput) {
    this.data = parseDomain(periodDefinitionSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get label() { return this.data.label }
  get dayOfWeek() { return this.data.dayOfWeek }
  get order() { return this.data.order }
  get startTime() { return this.data.startTime }
  get endTime() { return this.data.endTime }
  get isBreak() { return this.data.isBreak }
  get isTeachingSlot() { return this.data.isTeachingSlot }
  get createdAt() { return this.data.createdAt }

  get durationMinutes(): number {
    return timeRangeDurationMinutes(this.startTime, this.endTime)
  }
}
