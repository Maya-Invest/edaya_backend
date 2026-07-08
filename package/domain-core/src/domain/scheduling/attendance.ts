import { z } from 'zod'

import { dateTimeRangeDurationMinutes, refineEndsAtAfterStartsAt } from '../../domain/value-objects/date-time-range'

import { parseDomain, zodDate } from '../shared/utils'

export const attendanceBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  startsAt: zodDate(),
  endsAt: zodDate(),
  displayLabel: z.string().trim().min(1, 'displayLabel must not be blank'),
  createdAt: zodDate().default(() => new Date()),
})

function refineAttendance(data: { startsAt?: Date, endsAt?: Date }, ctx: z.RefinementCtx) {
  if (data.startsAt && data.endsAt) {
    refineEndsAtAfterStartsAt({ startsAt: data.startsAt, endsAt: data.endsAt }, ctx)
  }
}

export const attendanceSchema = attendanceBaseSchema.superRefine(refineAttendance)

export type AttendanceData = z.infer<typeof attendanceSchema>
export type AttendanceInput = z.input<typeof attendanceSchema>

export const attendanceCreateSchema = attendanceBaseSchema.omit({ createdAt: true }).superRefine(refineAttendance)
export const attendanceUpdateSchema = attendanceBaseSchema.partial().required({ id: true }).superRefine(refineAttendance)

/**
 * Class-wide daily attendance occurrence for primary-school daily mode.
 */
export class Attendance {
  readonly data: AttendanceData

  constructor(args: AttendanceInput) {
    this.data = parseDomain(attendanceSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get classGroupId() { return this.data.classGroupId }
  get startsAt() { return this.data.startsAt }
  get endsAt() { return this.data.endsAt }
  get displayLabel() { return this.data.displayLabel }
  get createdAt() { return this.data.createdAt }

  get durationMinutes(): number {
    return dateTimeRangeDurationMinutes(this.startsAt, this.endsAt)
  }
}
