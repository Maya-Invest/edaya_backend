import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { Session } from '../../domain'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, noopReadAccess, permissionAction, read, write } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { zodTimeOfDay } from '../../domain/value-objects/time-of-day'
import { refineTimeRangeStrictAfter } from '../../domain/value-objects/time-range'
import { parseDomain, zodDate } from '../shared/utils'

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
  startTime: zodTimeOfDay('startTime'),
  endTime: zodTimeOfDay('endTime'),
  specificDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineSchedule(data: any, ctx: z.RefinementCtx) {
  refineTimeRangeStrictAfter(data, ctx)
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
export type ScheduleInput = z.input<typeof scheduleSchema>

export const scheduleCreateSchema = scheduleBaseSchema.omit({ createdAt: true }).superRefine(refineSchedule)
export const scheduleUpdateSchema = scheduleBaseSchema.partial().required({ id: true }).superRefine(refineSchedule)

/**
 * Defines a recurring (weekly template) or non-recurring (one-off) schedule slot for a ClassGroup.
 * Serves as the template mapping day, time boundaries, and optional subject.
 * Calendar Sessions are generated dynamically based on these schedules.
 */
export class Schedule {
  readonly data: ScheduleData

  constructor(args: ScheduleInput) {
    this.data = parseDomain(scheduleSchema, args)
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
    read: read(permissionAction(Permission.QUERY_TIMETABLE_READ), noopReadAccess),
    write: write(permissionAction(Permission.TIMETABLE_UPDATE), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
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
