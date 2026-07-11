import { z } from 'zod'

import { DayOfWeek } from '../scheduling/schedule'
import { parseDomain, zodDate } from '../shared/utils'

export enum TeacherUnavailabilityRecurrence {
  OneOff = 'one_off',
  Weekly = 'weekly',
}

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must use HH:mm format')

export const teacherUnavailabilityBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  teacherId: z.string().trim().min(1, 'teacherId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  recurrence: z.nativeEnum(TeacherUnavailabilityRecurrence),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional().transform(value => value ?? undefined),
  startTime: timeSchema.nullable().optional().transform(value => value ?? undefined),
  endTime: timeSchema.nullable().optional().transform(value => value ?? undefined),
  effectiveFrom: zodDate().nullable().optional().transform(value => value ?? undefined),
  effectiveUntil: zodDate().nullable().optional().transform(value => value ?? undefined),
  startsAt: zodDate().nullable().optional().transform(value => value ?? undefined),
  endsAt: zodDate().nullable().optional().transform(value => value ?? undefined),
  reason: z.string().trim().min(1, 'reason must not be blank').nullable().optional().transform(value => value ?? undefined),
  isActive: z.boolean().default(true),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().nullable().optional().transform(value => value ?? undefined),
})

function refineTeacherUnavailability(
  data: {
    recurrence?: TeacherUnavailabilityRecurrence
    dayOfWeek?: DayOfWeek | null
    startTime?: string | null
    endTime?: string | null
    effectiveFrom?: Date | string | null
    effectiveUntil?: Date | string | null
    startsAt?: Date | string | null
    endsAt?: Date | string | null
  },
  ctx: z.RefinementCtx,
): void {
  if (!data.recurrence) {
    return
  }
  if (data.recurrence === TeacherUnavailabilityRecurrence.Weekly) {
    for (const field of ['dayOfWeek', 'startTime', 'endTime', 'effectiveFrom', 'effectiveUntil'] as const) {
      if (!data[field]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${field} is required for weekly recurrence`, path: [field] })
      }
    }
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'startTime must be before endTime', path: ['endTime'] })
    }
    if (data.effectiveFrom && data.effectiveUntil && new Date(data.effectiveFrom) > new Date(data.effectiveUntil)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'effectiveFrom must not be after effectiveUntil', path: ['effectiveUntil'] })
    }
    return
  }

  if (!data.startsAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'startsAt is required for one-off recurrence', path: ['startsAt'] })
  }
  if (!data.endsAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'endsAt is required for one-off recurrence', path: ['endsAt'] })
  }
  if (data.startsAt && data.endsAt && new Date(data.startsAt) >= new Date(data.endsAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'startsAt must be before endsAt', path: ['endsAt'] })
  }
}

export const teacherUnavailabilitySchema = teacherUnavailabilityBaseSchema.superRefine(refineTeacherUnavailability)
export const teacherUnavailabilityCreateSchema = teacherUnavailabilityBaseSchema.omit({ createdAt: true }).superRefine(refineTeacherUnavailability)
export const teacherUnavailabilityUpdateSchema = teacherUnavailabilityBaseSchema.partial().required({ id: true }).superRefine(refineTeacherUnavailability)
export type TeacherUnavailabilityData = z.infer<typeof teacherUnavailabilitySchema>
export type TeacherUnavailabilityInput = z.input<typeof teacherUnavailabilityBaseSchema>

/** A hard recurring or one-off teacher scheduling constraint. */
export class TeacherUnavailability {
  readonly data: TeacherUnavailabilityData

  constructor(args: TeacherUnavailabilityInput) {
    this.data = parseDomain(teacherUnavailabilitySchema, args)
  }

  get id() { return this.data.id }
  get teacherId() { return this.data.teacherId }
  get academicYearId() { return this.data.academicYearId }
  get recurrence() { return this.data.recurrence }
  get dayOfWeek() { return this.data.dayOfWeek }
  get startTime() { return this.data.startTime }
  get endTime() { return this.data.endTime }
  get effectiveFrom() { return this.data.effectiveFrom }
  get effectiveUntil() { return this.data.effectiveUntil }
  get startsAt() { return this.data.startsAt }
  get endsAt() { return this.data.endsAt }
  get reason() { return this.data.reason }
  get isActive() { return this.data.isActive }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}
