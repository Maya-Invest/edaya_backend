import type { ActivityEnrollment } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { config } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/school-life/activity-enrollment.ts (PR3)
export const activityEnrollmentConfig: EntityConfigFactory<ActivityEnrollment> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.activityEnrollments,
    tenant: activityEnrollmentTenant(),
    resource: 'activityEnrollments',

    gates: {
      preSave: validateActivityEnrollmentSave,
    },
    atomicExecution,
  })

function activityEnrollmentTenant(): EntityTenantResolver<ActivityEnrollment> {
  return indirectTenant(async (entity, repos) => {
    const activity = await repos.activities.findById(entity.activityId)
    return activity?.schoolId
  })
}

export async function validateActivityEnrollmentSave(
  enrollment: ActivityEnrollment,
  _existing: ActivityEnrollment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [activity, student] = await Promise.all([
    repositories.activities.findById(enrollment.activityId),
    repositories.students.findById(enrollment.studentId),
  ])

  if (!activity || !student || student.schoolId !== activity.schoolId) {
    denyResourceAccess()
  }
}
