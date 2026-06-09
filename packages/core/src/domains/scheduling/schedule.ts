import type { Session } from '../../domains'
import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, noopReadAccess, permissionAction, read, write } from '../../shared'
import { requireNonBlank, requireOptionalNonBlank, requireTimeOfDay, requireValidDate } from '../utils'

export enum DayOfWeek {
  Monday = 'monday',
  Tuesday = 'tuesday',
  Wednesday = 'wednesday',
  Thursday = 'thursday',
  Friday = 'friday',
  Saturday = 'saturday',
  Sunday = 'sunday',
}

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
  readonly id: string
  readonly classGroupId: string
  readonly classSubjectId?: string
  readonly title: string
  readonly isRecurring: boolean
  readonly dayOfWeek?: DayOfWeek
  readonly startTime: string
  readonly endTime: string
  readonly specificDate?: Date
  readonly createdAt: Date

  constructor({
    id,
    classGroupId,
    classSubjectId,
    title,
    isRecurring,
    dayOfWeek,
    startTime,
    endTime,
    specificDate,
    createdAt,
  }: ScheduleArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.classSubjectId = requireOptionalNonBlank(classSubjectId, 'classSubjectId')
    this.title = requireNonBlank(title, 'title')
    this.isRecurring = isRecurring

    const normalizedStartTime = requireTimeOfDay(startTime, 'startTime')
    const normalizedEndTime = requireTimeOfDay(endTime, 'endTime')
    if (normalizedStartTime >= normalizedEndTime) {
      throw new Error('endTime must be after startTime')
    }

    this.startTime = normalizedStartTime
    this.endTime = normalizedEndTime

    if (this.isRecurring) {
      if (!dayOfWeek) {
        throw new Error('dayOfWeek is required for recurring schedules')
      }
      this.dayOfWeek = dayOfWeek
    }
    else {
      if (!specificDate) {
        throw new Error('specificDate is required for non-recurring schedules')
      }
      this.specificDate = requireValidDate(specificDate, 'specificDate')
    }

    this.createdAt = createdAt ?? new Date()
  }
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
