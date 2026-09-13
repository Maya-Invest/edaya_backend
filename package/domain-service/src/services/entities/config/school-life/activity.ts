import type { Activity } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'

import { BusinessRuleViolationError } from '@edaya/core'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/school-life/activity.ts (PR3)
export const activityConfig: EntityConfigFactory<Activity> = ({ repositories, atomicExecution }) => ({
  ...config({
    repository: repositories.activities,
    tenant: directSchoolTenant(),
    resource: 'activities',

    atomicExecution,
  }),
  gates: {
    preDelete: validateActivityDelete,
  },
})

export async function validateActivityDelete(
  activity: Activity,
  repositories: SchoolRepositories,
): Promise<void> {
  const [studentEnrollments, classEnrollments] = await Promise.all([
    repositories.activityEnrollments.list({ activityId: activity.id }),
    repositories.classActivityEnrollments.list({ activityId: activity.id }),
  ])
  if (studentEnrollments.length > 0 || classEnrollments.length > 0) {
    throw new BusinessRuleViolationError(
      'ACTIVITY_HAS_DEPENDENCIES',
      `Cannot delete activity ${activity.id}: enrollments still exist`,
    )
  }
}
