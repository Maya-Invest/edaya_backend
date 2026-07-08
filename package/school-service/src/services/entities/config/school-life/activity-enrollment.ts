import type { AuthorizationPolicy } from '@edaya/authorization'
import type { ActivityEnrollment } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver, EntityWriteAuthorization } from '../../entity-config'
import { denyResourceAccess, DisciplineOperations } from '@edaya/authorization'
import { config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/school-life/activity-enrollment.ts (PR3)
export const activityEnrollmentConfig: EntityConfigFactory<ActivityEnrollment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.activityEnrollments,
    tenant: activityEnrollmentTenant(),
    read: read(operationModule(DisciplineOperations.read), noopReadAccess),
    write: write(
      operationModule(DisciplineOperations.create),
      authorizeActivityEnrollmentSave(policy),
      authorizeActivityEnrollmentDelete(policy),
    ),
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

function authorizeActivityEnrollmentSave(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<ActivityEnrollment>['authorizeSave'] {
  return async (actor, entity, existing) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
    if (existing) {
      await policy.checkStudentAccess(actor, [existing.studentId])
    }
  }
}

function authorizeActivityEnrollmentDelete(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<ActivityEnrollment>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
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
