import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../application/entities/managed-entity-service'
import type { AuthorizationPolicy } from '../../capabilities/authorization'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { config, indirectTenant, noopReadAccess, permissionAction, read, write } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { StudentClassEnrollmentStatus } from '../../domain'
import { parseDomain, zodDate } from '../shared/utils'

export enum HomeworkSubmissionStatus {
  Submitted = 'submitted',
  Late = 'late',
  Missing = 'missing',
}

export const homeworkSubmissionBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  homeworkAssignmentId: z.string().trim().min(1, 'homeworkAssignmentId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  status: z.nativeEnum(HomeworkSubmissionStatus),
  submittedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineHomeworkSubmission(data: any, ctx: z.RefinementCtx) {
  if (data.status !== HomeworkSubmissionStatus.Missing && !data.submittedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'submittedAt is required when status is not missing',
    })
  }
}

export const homeworkSubmissionSchema = homeworkSubmissionBaseSchema.superRefine(refineHomeworkSubmission)

export type HomeworkSubmissionData = z.infer<typeof homeworkSubmissionSchema>
export type HomeworkSubmissionInput = z.input<typeof homeworkSubmissionSchema>

export const homeworkSubmissionCreateSchema = homeworkSubmissionBaseSchema.omit({ createdAt: true }).superRefine(refineHomeworkSubmission)
export const homeworkSubmissionUpdateSchema = homeworkSubmissionBaseSchema.partial().required({ id: true }).superRefine(refineHomeworkSubmission)

/**
 * Tracks a student's submission status for a homework assignment.
 */
export class HomeworkSubmission {
  readonly data: HomeworkSubmissionData

  constructor(args: HomeworkSubmissionInput) {
    this.data = parseDomain(homeworkSubmissionSchema, args)
  }

  get id() { return this.data.id }
  get homeworkAssignmentId() { return this.data.homeworkAssignmentId }
  get studentId() { return this.data.studentId }
  get status() { return this.data.status }
  get submittedAt() { return this.data.submittedAt }
  get createdAt() { return this.data.createdAt }
}

export const homeworkSubmissionConfig: EntityConfigFactory<HomeworkSubmission> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.homeworkSubmissions,
    tenant: homeworkSubmissionTenant(),
    read: read(permissionAction(Permission.CLASS_LOGBOOK_READ), noopReadAccess),
    write: write(
      permissionAction(Permission.CLASS_LOGBOOK_UPDATE),
      authorizeHomeworkSubmissionSave(policy),
      authorizeHomeworkSubmissionDelete(policy),
    ),
    gates: {
      preSave: validateHomeworkSubmissionSave,
    },
    atomicExecution,
  })

function homeworkSubmissionTenant(): EntityTenantResolver<HomeworkSubmission> {
  return indirectTenant(async (entity, repos) => {
    const assignment = await repos.homeworkAssignments.findById(entity.homeworkAssignmentId)
    if (!assignment) {
      return undefined
    }
    const classGroup = await repos.classGroups.findById(assignment.classGroupId)
    return classGroup?.schoolId
  })
}

function authorizeHomeworkSubmissionSave(policy: AuthorizationPolicy): EntityWriteAuthorization<HomeworkSubmission>['authorizeSave'] {
  return async (actor, entity, existing, repositories) => {
    const assignment = await repositories.homeworkAssignments.findById(entity.homeworkAssignmentId)
    if (!assignment) {
      denyResourceAccess()
    }
    await policy.checkClassGroupAccess(actor, [assignment.classGroupId])
    if (existing) {
      const existingAssignment = await repositories.homeworkAssignments.findById(existing.homeworkAssignmentId)
      if (existingAssignment) {
        await policy.checkClassGroupAccess(actor, [existingAssignment.classGroupId])
      }
    }
  }
}

function authorizeHomeworkSubmissionDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<HomeworkSubmission>['authorizeDelete'] {
  return async (actor, entity, repositories) => {
    const assignment = await repositories.homeworkAssignments.findById(entity.homeworkAssignmentId)
    if (!assignment) {
      denyResourceAccess()
    }
    await policy.checkClassGroupAccess(actor, [assignment.classGroupId])
  }
}

async function validateHomeworkSubmissionSave(
  submission: HomeworkSubmission,
  _existing: HomeworkSubmission | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const assignment = await repositories.homeworkAssignments.findById(submission.homeworkAssignmentId)
  if (!assignment) {
    denyResourceAccess()
  }

  const enrollments = await repositories.enrollments.list({
    studentId: submission.studentId,
    classGroupId: assignment.classGroupId,
  })
  const activeEnrollment = enrollments.find(enrollment => enrollment.status === StudentClassEnrollmentStatus.Active)
  if (!activeEnrollment) {
    denyResourceAccess()
  }
}
