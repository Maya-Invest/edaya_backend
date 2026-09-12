import { Permission } from '@edaya/core';
import type { ActivitySession } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';
import { denyResourceAccess } from '@edaya/authorization';
import { BusinessRuleViolationError, OccurrenceStatus } from '@edaya/core';
import { config } from '../../entity-config';
import { classGroupLinkedTenant } from '../../entity-config/tenant';

// Extracted from domain/scheduling/activity-session.ts (PR3)
export const activitySessionConfig: EntityConfigFactory<ActivitySession> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.activitySessions,
    tenant: classGroupLinkedTenant('classGroupId'),
    authorization: { resource: 'activitySessions', read: [Permission.QUERY_TIMETABLE_READ, Permission.TIMETABLE_UPDATE, Permission.TIMETABLE_CREATE, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE], write: [Permission.TIMETABLE_UPDATE] },
    
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
