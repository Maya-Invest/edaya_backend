import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../application/entities/managed-entity-service'
import type { AuthorizationPolicy } from '../../capabilities/authorization'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { config, indirectTenant, noopReadAccess, permissionAction, read, resolveActivitySessionSchoolId, resolveClassSubjectSchoolId, resolveLessonSessionSchoolId, write } from '../../application/entities/entity-config'

import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { parseDomain, zodDate } from '../shared/utils'

export const staffAssignmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  staffId: z.string().trim().min(1, 'staffId must not be blank'),
  responsibility: z.string().trim().min(1, 'responsibility must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  lessonSessionId: z.string().trim().min(1, 'lessonSessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  activitySessionId: z.string().trim().min(1, 'activitySessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  assessmentId: z.string().trim().min(1, 'assessmentId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineStaffAssignment(
  data: {
    classGroupId?: string
    classSubjectId?: string
    lessonSessionId?: string
    activitySessionId?: string
    assessmentId?: string
  },
  ctx: z.RefinementCtx,
) {
  const targets = [data.classGroupId, data.classSubjectId, data.lessonSessionId, data.activitySessionId, data.assessmentId].filter(Boolean)
  if (targets.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A StaffAssignment must target exactly one of: classGroupId, classSubjectId, lessonSessionId, activitySessionId, or assessmentId',
    })
  }
}

export const staffAssignmentSchema = staffAssignmentBaseSchema.superRefine(refineStaffAssignment)
export type StaffAssignmentData = z.infer<typeof staffAssignmentSchema>
export type StaffAssignmentInput = z.input<typeof staffAssignmentSchema>

export const staffAssignmentCreateSchema = staffAssignmentBaseSchema.omit({ createdAt: true }).superRefine(refineStaffAssignment)
export const staffAssignmentUpdateSchema = staffAssignmentBaseSchema.partial().required({ id: true }).superRefine(refineStaffAssignment)

/**
 * Assigns a staff member (with a free-form responsibility label) to a class, subject, or occurrence.
 */
export class StaffAssignment {
  readonly data: StaffAssignmentData

  constructor(args: StaffAssignmentInput) {
    this.data = parseDomain(staffAssignmentSchema, args)
  }

  get id() { return this.data.id }
  get staffId() { return this.data.staffId }
  get responsibility() { return this.data.responsibility }
  get classGroupId() { return this.data.classGroupId }
  get classSubjectId() { return this.data.classSubjectId }
  get lessonSessionId() { return this.data.lessonSessionId }
  get activitySessionId() { return this.data.activitySessionId }
  get assessmentId() { return this.data.assessmentId }
  get createdAt() { return this.data.createdAt }
}

export const staffAssignmentConfig: EntityConfigFactory<StaffAssignment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.staffAssignments,
    tenant: staffAssignmentTenant(),
    read: read(permissionAction(Permission.SCHOOL_STRUCTURE_CONFIGURE), noopReadAccess),
    write: write(permissionAction(Permission.ACCESS_CONTROL_ASSIGN), authorizeStaffAssignment(policy), authorizeStaffAssignmentDelete(policy)),
    gates: {
      preSave: validateStaffAssignmentSave,
    },
    atomicExecution,
  })

function staffAssignmentTenant(): EntityTenantResolver<StaffAssignment> {
  return indirectTenant(async (entity, repositories) => {
    if (entity.classGroupId)
      return (await repositories.classGroups.findById(entity.classGroupId))?.schoolId
    if (entity.classSubjectId)
      return resolveClassSubjectSchoolId(repositories, entity.classSubjectId)
    if (entity.lessonSessionId)
      return resolveLessonSessionSchoolId(repositories, entity.lessonSessionId)
    if (entity.activitySessionId)
      return resolveActivitySessionSchoolId(repositories, entity.activitySessionId)
    if (entity.assessmentId) {
      const assessment = await repositories.assessments.findById(entity.assessmentId)
      if (!assessment) {
        return undefined
      }
      return (await repositories.classGroups.findById(assessment.classGroupId))?.schoolId
    }
    return undefined
  })
}

function authorizeStaffAssignment(policy: AuthorizationPolicy): EntityWriteAuthorization<StaffAssignment>['authorizeSave'] {
  return async (actor, entity, _existing, repositories) => {
    if (entity.classGroupId)
      await policy.checkClassGroupAccess(actor, [entity.classGroupId])
    if (entity.classSubjectId) {
      const classSubject = await repositories.classSubjects.findById(entity.classSubjectId)
      if (classSubject)
        await policy.checkClassGroupAccess(actor, [classSubject.classGroupId])
    }
    if (entity.lessonSessionId)
      await policy.checkLessonSessionAccess(actor, [entity.lessonSessionId])
    if (entity.activitySessionId)
      await policy.checkActivitySessionAccess(actor, [entity.activitySessionId])
    if (entity.assessmentId)
      await policy.checkAssessmentAccess(actor, [entity.assessmentId])
  }
}

function authorizeStaffAssignmentDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<StaffAssignment>['authorizeDelete'] {
  return async (actor, entity, repositories) => authorizeStaffAssignment(policy)(actor, entity, entity, repositories)
}

export async function validateStaffAssignmentSave(
  assignment: StaffAssignment,
  _existing: StaffAssignment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const staffMember = await repositories.staffMembers.findById(assignment.staffId)
  if (!staffMember) {
    denyResourceAccess()
  }
  const targetSchoolId = await resolveStaffAssignmentTargetSchoolId(assignment, repositories)
  if (!targetSchoolId || staffMember.schoolId !== targetSchoolId) {
    denyResourceAccess()
  }
}

async function resolveStaffAssignmentTargetSchoolId(
  assignment: StaffAssignment,
  repositories: SchoolRepositories,
): Promise<string | undefined> {
  if (assignment.classGroupId) {
    return (await repositories.classGroups.findById(assignment.classGroupId))?.schoolId
  }
  if (assignment.classSubjectId) {
    const classSubject = await repositories.classSubjects.findById(assignment.classSubjectId)
    if (!classSubject)
      return undefined
    return (await repositories.classGroups.findById(classSubject.classGroupId))?.schoolId
  }
  if (assignment.lessonSessionId) {
    return resolveLessonSessionSchoolId(repositories, assignment.lessonSessionId)
  }
  if (assignment.activitySessionId) {
    return resolveActivitySessionSchoolId(repositories, assignment.activitySessionId)
  }
  if (assignment.assessmentId) {
    const assessment = await repositories.assessments.findById(assignment.assessmentId)
    if (!assessment) {
      return undefined
    }
    return (await repositories.classGroups.findById(assessment.classGroupId))?.schoolId
  }
  return undefined
}
