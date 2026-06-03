import type { AuthorizationPolicy } from '../../../authorization'
import type { StaffAssignment } from '../../../entities/school/staff-assignment'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared/common'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { denyResourceAccess } from '../../../authorization'
import { action, config, indirectTenant, noopReadAccess, read, resolveClassSubjectSchoolId, resolveSessionSchoolId, write } from '../../../shared/common'

export const staffAssignmentConfig: EntityConfigFactory<StaffAssignment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.staffAssignments,
    tenant: staffAssignmentTenant(),
    read: read(action(policy, 'setup.manage'), noopReadAccess),
    write: write(action(policy, 'setup.assign_staff'), authorizeStaffAssignment(policy), authorizeStaffAssignmentDelete(policy)),
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
