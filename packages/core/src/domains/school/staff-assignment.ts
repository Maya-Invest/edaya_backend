import type { AuthorizationPolicy } from '../../authorization'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { denyResourceAccess, Permission } from '../../authorization'
import { config, indirectTenant, noopReadAccess, permissionAction, read, resolveClassSubjectSchoolId, resolveSessionSchoolId, write } from '../../shared'
import { requireNonBlank, requireOptionalNonBlank } from '../utils'

export interface StaffAssignmentArgs {
  id: string
  staffId: string
  responsibility: string
  classGroupId?: string | null
  classSubjectId?: string | null
  sessionId?: string | null
  createdAt?: Date
}

/**
 * Assigns a staff member (with a free-form responsibility label) to a ClassGroup, ClassSubject, or Session.
 */
export class StaffAssignment {
  readonly id: string
  readonly staffId: string
  readonly responsibility: string
  readonly classGroupId?: string
  readonly classSubjectId?: string
  readonly sessionId?: string
  readonly createdAt: Date

  constructor({
    id,
    staffId,
    responsibility,
    classGroupId,
    classSubjectId,
    sessionId,
    createdAt,
  }: StaffAssignmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.staffId = requireNonBlank(staffId, 'staffId')
    this.responsibility = requireNonBlank(responsibility, 'responsibility')

    this.classGroupId = requireOptionalNonBlank(classGroupId, 'classGroupId')
    this.classSubjectId = requireOptionalNonBlank(classSubjectId, 'classSubjectId')
    this.sessionId = requireOptionalNonBlank(sessionId, 'sessionId')

    const targets = [this.classGroupId, this.classSubjectId, this.sessionId].filter(Boolean)
    if (targets.length !== 1) {
      throw new Error('A StaffAssignment must target exactly one of: classGroupId, classSubjectId, or sessionId')
    }

    this.createdAt = createdAt ?? new Date()
  }
}

export const staffAssignmentConfig: EntityConfigFactory<StaffAssignment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.staffAssignments,
    tenant: staffAssignmentTenant(),
    read: read(permissionAction(policy, Permission.SCHOOL_STRUCTURE_CONFIGURE), noopReadAccess),
    write: write(permissionAction(policy, Permission.ACCESS_CONTROL_ASSIGN), authorizeStaffAssignment(policy), authorizeStaffAssignmentDelete(policy)),
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
    if (entity.sessionId)
      return resolveSessionSchoolId(repositories, entity.sessionId)
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
    if (entity.sessionId)
      await policy.checkSessionAccess(actor, [entity.sessionId])
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
  if (assignment.sessionId) {
    const session = await repositories.sessions.findById(assignment.sessionId)
    if (!session)
      return undefined
    return (await repositories.classGroups.findById(session.classGroupId))?.schoolId
  }
  return undefined
}
