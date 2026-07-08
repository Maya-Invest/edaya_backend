import type { AuthorizationPolicy } from '@edaya/authorization'
import type { StaffAssignment } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver, EntityWriteAuthorization } from '../../entity-config'
import { AccessControlOperations, deleteSyncedStaffAssignmentPermissions, denyResourceAccess, resolveStaffAssignmentTarget, SchoolStructureOperations, syncStaffAssignmentPermissions, validateStaffAssignmentPermissionSelection, WorkspaceOperations } from '@edaya/authorization'
import { anyOperationModule, config, operationModule, read, write } from '../../entity-config'
import { indirectTenant, resolveActivitySessionSchoolId, resolveClassSubjectSchoolId, resolveLessonSessionSchoolId } from '../../entity-config/tenant'

// Extracted from domain/school/staff-assignment.ts (PR3)
export const staffAssignmentConfig: EntityConfigFactory<StaffAssignment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.staffAssignments,
    tenant: staffAssignmentTenant(),
    read: read(
      anyOperationModule([
        WorkspaceOperations.read,
        SchoolStructureOperations.configure,
      ]),
      (actor, entities) => policy.checkStaffAssignmentAccess(actor, entities),
    ),
    write: write(operationModule(AccessControlOperations.assign), authorizeStaffAssignment(policy), authorizeStaffAssignmentDelete(policy)),
    gates: {
      preSave: validateStaffAssignmentSave,
    },
    hooks: {
      postSave: async (assignment, _existing, repos) => {
        await syncStaffAssignmentPermissions(assignment, repos)
      },
      postDelete: async (assignment, repos) => {
        await deleteSyncedStaffAssignmentPermissions(assignment.id, repos)
      },
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

  const academicYear = await repositories.academicYears.findById(assignment.academicYearId)
  if (!academicYear || academicYear.schoolId !== staffMember.schoolId) {
    denyResourceAccess()
  }

  if ((assignment.permissions?.length ?? 0) > 0) {
    const target = await resolveStaffAssignmentTarget(assignment, repositories)
    validateStaffAssignmentPermissionSelection(assignment, target)
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
