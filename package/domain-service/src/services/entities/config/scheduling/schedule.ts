import type { Schedule } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, isActivityAvailableForClassGroup, ScheduleKind } from '@edaya/core'
import { config } from '../../entity-config'
import { classGroupLinkedTenant } from '../../entity-config/tenant'

// Extracted from domain/scheduling/schedule.ts (PR3)
export const scheduleConfig: EntityConfigFactory<Schedule> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.schedules,
    tenant: classGroupLinkedTenant('classGroupId'),
    resource: 'schedules',

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
