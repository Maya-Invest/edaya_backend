import type { ClassActivityEnrollment } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess, SchedulingOperations } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { classGroupLinkedTenant } from '../../entity-config/tenant'

// Extracted from domain/school-life/class-activity-enrollment.ts (PR3)
export const classActivityEnrollmentConfig: EntityConfigFactory<ClassActivityEnrollment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classActivityEnrollments,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(operationModule(SchedulingOperations.timetableRead), noopReadAccess),
    write: write(
      operationModule(SchedulingOperations.timetableManage),
      authorizeClassGroupLinked(policy, 'classGroupId'),
      authorizeClassGroupLinkedDelete(policy),
    ),
    gates: {
      preSave: validateClassActivityEnrollmentSave,
    },
    atomicExecution,
  })

export async function validateClassActivityEnrollmentSave(
  enrollment: ClassActivityEnrollment,
  existing: ClassActivityEnrollment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [activity, classGroup] = await Promise.all([
    repositories.activities.findById(enrollment.activityId),
    repositories.classGroups.findById(enrollment.classGroupId),
  ])

  if (!activity || !classGroup || activity.schoolId !== classGroup.schoolId) {
    denyResourceAccess()
  }

  if (existing && existing.activityId !== enrollment.activityId) {
    denyResourceAccess()
  }

  const siblings = await repositories.classActivityEnrollments.list({
    activityId: enrollment.activityId,
    classGroupId: enrollment.classGroupId,
  })
  const duplicate = siblings.find(row => row.id !== enrollment.id)
  if (duplicate) {
    throw new BusinessRuleViolationError(
      'CLASS_ACTIVITY_ENROLLMENT_ALREADY_EXISTS',
      `Activity ${enrollment.activityId} is already enrolled in class group ${enrollment.classGroupId}`,
    )
  }
}
