import type { AuthorizationPolicy } from '../../authorization'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { denyResourceAccess, Permission } from '../../authorization'
import { config, indirectTenant, noopReadAccess, permissionAction, read, write } from '../../shared'
import { parseDomain, zodDate } from '../utils'

export enum ActivityEnrollmentStatus {
  Approved = 'approved',
  Pending = 'pending',
  Denied = 'denied',
}

export const activityEnrollmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  activityId: z.string().trim().min(1, 'activityId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  status: z.nativeEnum(ActivityEnrollmentStatus),
  createdAt: zodDate().default(() => new Date()),
})

export const activityEnrollmentSchema = activityEnrollmentBaseSchema

export type ActivityEnrollmentData = z.infer<typeof activityEnrollmentSchema>
export type ActivityEnrollmentInput = z.input<typeof activityEnrollmentSchema>

export const activityEnrollmentCreateSchema = activityEnrollmentBaseSchema.omit({ createdAt: true })
export const activityEnrollmentUpdateSchema = activityEnrollmentBaseSchema.partial().required({ id: true })

/**
 * Student enrollment in an extracurricular activity.
 */
export class ActivityEnrollment {
  readonly data: ActivityEnrollmentData

  constructor(args: ActivityEnrollmentInput) {
    this.data = parseDomain(activityEnrollmentSchema, args)
  }

  get id() { return this.data.id }
  get activityId() { return this.data.activityId }
  get studentId() { return this.data.studentId }
  get status() { return this.data.status }
  get createdAt() { return this.data.createdAt }
}

export const activityEnrollmentConfig: EntityConfigFactory<ActivityEnrollment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.activityEnrollments,
    tenant: activityEnrollmentTenant(),
    read: read(permissionAction(Permission.QUERY_CALENDAR_READ), noopReadAccess),
    write: write(
      permissionAction(Permission.DISCIPLINE_CREATE),
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

async function validateActivityEnrollmentSave(
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
