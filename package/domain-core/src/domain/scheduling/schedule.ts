import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, noopReadAccess, permissionAction, read, write } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { zodTimeOfDay } from '../../domain/value-objects/time-of-day'
import { refineTimeRangeStrictAfter } from '../../domain/value-objects/time-range'
import { isActivityAvailableForClassGroup } from '../school-life/class-activity-enrollment'
import { parseDomain, zodDate } from '../shared/utils'

export enum ScheduleKind {
  Lesson = 'lesson',
  Activity = 'activity',
}

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
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  scheduleKind: z.nativeEnum(ScheduleKind).default(ScheduleKind.Lesson),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  activityId: z.string().trim().min(1, 'activityId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  title: z.string().trim().min(1, 'title must not be blank'),
  isRecurring: z.boolean(),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional().transform(v => v === null ? undefined : v),
  startTime: zodTimeOfDay('startTime'),
  endTime: zodTimeOfDay('endTime'),
  specificDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineSchedule(
  data: {
    scheduleKind?: ScheduleKind
    classSubjectId?: string
    activityId?: string
    isRecurring?: boolean
    dayOfWeek?: DayOfWeek
    specificDate?: Date
    startTime?: string
    endTime?: string
  },
  ctx: z.RefinementCtx,
) {
  if (data.startTime && data.endTime) {
    refineTimeRangeStrictAfter({ startTime: data.startTime, endTime: data.endTime }, ctx)
  }
  if (data.scheduleKind === ScheduleKind.Lesson && !data.classSubjectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'classSubjectId is required for lesson schedules',
      path: ['classSubjectId'],
    })
  }
  if (data.scheduleKind === ScheduleKind.Activity && !data.activityId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'activityId is required for activity schedules',
      path: ['activityId'],
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
export type ScheduleInput = z.input<typeof scheduleSchema>

export const scheduleCreateSchema = scheduleBaseSchema.omit({ createdAt: true }).superRefine(refineSchedule)
export const scheduleUpdateSchema = scheduleBaseSchema.partial().required({ id: true }).superRefine(refineSchedule)

/**
 * Configuration for a recurring or one-off lesson or activity slot.
 * Materializes LessonSession or ActivitySession rows within the academic year window.
 */
export class Schedule {
  readonly data: ScheduleData

  constructor(args: ScheduleInput) {
    this.data = parseDomain(scheduleSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get classGroupId() { return this.data.classGroupId }
  get scheduleKind() { return this.data.scheduleKind }
  get classSubjectId() { return this.data.classSubjectId }
  get activityId() { return this.data.activityId }
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
  const classGroup = await repositories.classGroups.findById(schedule.classGroupId)
  if (!classGroup || classGroup.schoolId !== schedule.schoolId) {
    denyResourceAccess()
  }
  if (schedule.scheduleKind === ScheduleKind.Lesson) {
    await requireValidClassSubject(schedule.classSubjectId, schedule.classGroupId, repositories)
  }
  if (schedule.scheduleKind === ScheduleKind.Activity && schedule.activityId) {
    const activity = await repositories.activities.findById(schedule.activityId)
    if (!activity || activity.schoolId !== schedule.schoolId) {
      throw new BusinessRuleViolationError('ACTIVITY_REQUIRED', `Activity ${schedule.activityId} is not valid for this school`)
    }
    const available = await isActivityAvailableForClassGroup(
      schedule.activityId,
      schedule.classGroupId,
      repositories,
    )
    if (!available) {
      throw new BusinessRuleViolationError(
        'ACTIVITY_NOT_ENROLLED_IN_CLASS',
        `Activity ${schedule.activityId} is not enrolled in class group ${schedule.classGroupId}`,
      )
    }
  }
}

async function requireValidClassSubject(
  classSubjectId: string | undefined,
  classGroupId: string,
  repositories: SchoolRepositories,
): Promise<void> {
  if (!classSubjectId) {
    return
  }
  const classSubject = await repositories.classSubjects.findById(classSubjectId)
  if (!classSubject || classSubject.classGroupId !== classGroupId) {
    denyResourceAccess()
  }
}
