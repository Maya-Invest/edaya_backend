import { z } from 'zod'

import { dateTimeRangeDurationMinutes, refineEndsAtAfterStartsAt } from '../../domain/value-objects/date-time-range'

import { parseDomain, zodDate } from '../shared/utils'

import { OccurrenceStatus } from './occurrence-status'

export const activitySessionBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  scheduleId: z.string().trim().min(1, 'scheduleId must not be blank'),
  activityId: z.string().trim().min(1, 'activityId must not be blank'),
  status: z.nativeEnum(OccurrenceStatus).default(OccurrenceStatus.Pending),
  isException: z.boolean().default(false),
  startsAt: zodDate(),
  endsAt: zodDate(),
  displayLabel: z.string().trim().min(1, 'displayLabel must not be blank'),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineActivitySession(data: { startsAt?: Date, endsAt?: Date }, ctx: z.RefinementCtx) {
  if (data.startsAt && data.endsAt) {
    refineEndsAtAfterStartsAt({ startsAt: data.startsAt, endsAt: data.endsAt }, ctx)
  }
}

export const activitySessionSchema = activitySessionBaseSchema.superRefine(refineActivitySession)

export type ActivitySessionData = z.infer<typeof activitySessionSchema>
export type ActivitySessionInput = z.input<typeof activitySessionSchema>

export const activitySessionCreateSchema = activitySessionBaseSchema.omit({ createdAt: true }).superRefine(refineActivitySession)
export const activitySessionUpdateSchema = activitySessionBaseSchema.partial().required({ id: true }).superRefine(refineActivitySession)

/**
 * Materialized extracurricular activity occurrence — one row per school day matching an activity schedule.
 */
export class ActivitySession {
  readonly data: ActivitySessionData

  constructor(args: ActivitySessionInput) {
    this.data = parseDomain(activitySessionSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get classGroupId() { return this.data.classGroupId }
  get scheduleId() { return this.data.scheduleId }
  get activityId() { return this.data.activityId }
  get status() { return this.data.status }
  get isException() { return this.data.isException }
  get startsAt() { return this.data.startsAt }
  get endsAt() { return this.data.endsAt }
  get displayLabel() { return this.data.displayLabel }
  get notes() { return this.data.notes }
  get createdAt() { return this.data.createdAt }

  get durationMinutes(): number {
    return dateTimeRangeDurationMinutes(this.startsAt, this.endsAt)
  }

  get isResyncEligible(): boolean {
    return this.status === OccurrenceStatus.Pending && !this.isException
  }

  copyWith(changes: Partial<ActivitySessionInput>): ActivitySession {
    return new ActivitySession({
      id: this.id,
      schoolId: this.schoolId,
      classGroupId: this.classGroupId,
      scheduleId: this.scheduleId,
      activityId: this.activityId,
      status: this.status,
      isException: this.isException,
      startsAt: this.startsAt,
      endsAt: this.endsAt,
      displayLabel: this.displayLabel,
      notes: this.notes,
      createdAt: this.createdAt,
      ...changes,
    })
  }
}
