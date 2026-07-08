import type { ActivitySession } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess, SchedulingOperations } from '@edaya/authorization'
import { BusinessRuleViolationError, OccurrenceStatus } from '@edaya/core'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, config, operationModule, read, readByIds, write } from '../../entity-config'
import { classGroupLinkedTenant } from '../../entity-config/tenant'

// Extracted from domain/scheduling/activity-session.ts (PR3)
export const activitySessionConfig: EntityConfigFactory<ActivitySession> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.activitySessions,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(
      operationModule(SchedulingOperations.timetableRead),
      readByIds((actor, ids) => policy.checkActivitySessionAccess(actor, ids)),
    ),
    write: write(
      operationModule(SchedulingOperations.timetableManage),
      authorizeClassGroupLinked(policy, 'classGroupId'),
      authorizeClassGroupLinkedDelete(policy),
    ),
    gates: {
      preSave: validateActivitySessionSave,
    },
    atomicExecution,
  })

export async function validateActivitySessionSave(
  activitySession: ActivitySession,
  existing: ActivitySession | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (existing && (existing.status === OccurrenceStatus.Completed || existing.status === OccurrenceStatus.Cancelled)) {
    if (
      activitySession.status !== existing.status
      || activitySession.startsAt.getTime() !== existing.startsAt.getTime()
      || activitySession.endsAt.getTime() !== existing.endsAt.getTime()
    ) {
      throw new BusinessRuleViolationError('OCCURRENCE_IMMUTABLE', `Activity session ${existing.id} is ${existing.status} and cannot be modified`)
    }
  }
  const activity = await repositories.activities.findById(activitySession.activityId)
  if (!activity || activity.schoolId !== activitySession.schoolId) {
    denyResourceAccess()
  }
}
