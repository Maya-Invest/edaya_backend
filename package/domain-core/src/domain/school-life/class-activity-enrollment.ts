import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, noopReadAccess, operationModule, read, write } from '../../application/entities/entity-config'
import { denyResourceAccess, SchedulingOperations } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export const classActivityEnrollmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  activityId: z.string().trim().min(1, 'activityId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  createdAt: zodDate().default(() => new Date()),
})

export const classActivityEnrollmentSchema = classActivityEnrollmentBaseSchema

export type ClassActivityEnrollmentData = z.infer<typeof classActivityEnrollmentSchema>
export type ClassActivityEnrollmentInput = z.input<typeof classActivityEnrollmentSchema>

export const classActivityEnrollmentCreateSchema = classActivityEnrollmentBaseSchema.omit({ createdAt: true })
export const classActivityEnrollmentUpdateSchema = classActivityEnrollmentBaseSchema.partial().required({ id: true })

/**
 * Links a school activity to a class group so it can appear on that class timetable.
 * Activities with no class enrollments remain school-wide.
 */
export class ClassActivityEnrollment {
  readonly data: ClassActivityEnrollmentData

  constructor(args: ClassActivityEnrollmentInput) {
    this.data = parseDomain(classActivityEnrollmentSchema, args)
  }

  get id() { return this.data.id }
  get activityId() { return this.data.activityId }
  get classGroupId() { return this.data.classGroupId }
  get createdAt() { return this.data.createdAt }
}

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

export async function isActivityAvailableForClassGroup(
  activityId: string,
  classGroupId: string,
  repositories: SchoolRepositories,
): Promise<boolean> {
  const classEnrollments = await repositories.classActivityEnrollments.list({ activityId })
  if (classEnrollments.length === 0) {
    return true
  }
  return classEnrollments.some(enrollment => enrollment.classGroupId === classGroupId)
}
