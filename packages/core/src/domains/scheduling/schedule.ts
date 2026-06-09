import type { Session } from '../../domains'
import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { Permission } from '../../authorization'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, noopReadAccess, permissionAction, read, write } from '../../shared'
import { DomainValidationError, formatZodError, zodDate } from '../utils'

export enum DayOfWeek {
  Monday = 'monday',
  Tuesday = 'tuesday',
  Wednesday = 'wednesday',
  Thursday = 'thursday',
  Friday = 'friday',
  Saturday = 'saturday',
  Sunday = 'sunday',
}

export const scheduleBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  title: z.string().trim().min(1, 'title must not be blank'),
  isRecurring: z.boolean(),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional().transform(v => v === null ? undefined : v),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'startTime must be a valid time in HH:mm format'),
  endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'endTime must be a valid time in HH:mm format'),
  specificDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineSchedule(data: any, ctx: z.RefinementCtx) {
  if (data.startTime >= data.endTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endTime must be after startTime',
    })
  }
  if (data.isRecurring) {
    if (!data.dayOfWeek) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dayOfWeek is required for recurring schedules',
      })
    }
  }
  else {
    if (!data.specificDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'specificDate is required for non-recurring schedules',
      })
    }
  }
}

export const scheduleSchema = scheduleBaseSchema.superRefine(refineSchedule)

export type ScheduleData = z.infer<typeof scheduleSchema>

export const scheduleCreateSchema = scheduleBaseSchema.omit({ createdAt: true }).superRefine(refineSchedule)
export const scheduleUpdateSchema = scheduleBaseSchema.partial().required({ id: true }).superRefine(refineSchedule)

export interface ScheduleArgs {
  id: string
  classGroupId: string
  classSubjectId?: string | null
  title: string
  isRecurring: boolean
  dayOfWeek?: DayOfWeek | null
  startTime: string
  endTime: string
  specificDate?: Date | null
  createdAt?: Date
}

/**
 * Defines a recurring (weekly template) or non-recurring (one-off) schedule slot for a ClassGroup.
 * Serves as the template mapping day, time boundaries, and optional subject.
 * Calendar Sessions are generated dynamically based on these schedules.
 */
export class Schedule {
  readonly data: ScheduleData

  constructor(args: ScheduleArgs) {
    const result = scheduleSchema.safeParse(args)
    if (!result.success) {
      throw new DomainValidationError(formatZodError(result.error))
    }
    this.data = result.data
  }

  get id() { return this.data.id }
  get classGroupId() { return this.data.classGroupId }
  get classSubjectId() { return this.data.classSubjectId }
  get title() { return this.data.title }
  get isRecurring() { return this.data.isRecurring }
  get dayOfWeek() { return this.data.dayOfWeek }
  get startTime() { return this.data.startTime }
  get endTime() { return this.data.endTime }
  get specificDate() { return this.data.specificDate }
  get createdAt() { return this.data.createdAt }
}

export const scheduleConfig: EntityConfigFactory<Schedule> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.schedules,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(permissionAction(policy, Permission.QUERY_TIMETABLE_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.TIMETABLE_UPDATE), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
    gates: {
      preSave: validateScheduleSave,
    },
    atomicExecution,
  })

export async function validateScheduleSave(
  schedule: Schedule,
  _existing: Schedule | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await requireValidClassSubject(schedule.classSubjectId, schedule.classGroupId, repositories)
}

export async function validateSessionSave(
  session: Session,
  _existing: Session | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await requireValidClassSubject(session.classSubjectId, session.classGroupId, repositories)
}

async function requireValidClassSubject(
  classSubjectId: string | undefined,
  classGroupId: string,
  repositories: SchoolRepositories,
): Promise<void> {
  if (!classSubjectId) {
    return
  }
  if (!repositories.classSubjects) {
    return
  }
  const classSubject = await repositories.classSubjects.findById(classSubjectId)
  if (!classSubject || classSubject.classGroupId !== classGroupId) {
    denyResourceAccess()
  }
}
