import type { EntityReadAuthorization, EntityWriteAuthorization } from '../../../application/entities/managed-entity-service'
import type { ActorMetadata, AuthorizationPolicy, AuthorizationRequest, TeacherActorMetadata } from '../../../capabilities/authorization'
import {
  assertGuardianCapability,
  assertHomeroomCapability,
  assertStudentCapability,
  assertTeachingCapability,
  AuthorizationError,
  AuthorizationErrorCode,
  authorize,
  capabilityTargetFromAuthorizationScope,
  guardianCapabilityForPermission,
  homeroomCapabilityForPermission,
  homeroomTargetFromAuthorizationScope,
  Permission,
  studentCapabilityForPermission,
  teachingCapabilityForPermission,
  teachingTargetFromAuthorizationScope,
} from '../../../capabilities/authorization'
import { TeachingCapability } from '../../../capabilities/authorization/capabilities/teaching-capability'
import { unique } from './helper-utils'

function teacherHasAnyAssignment(actor: TeacherActorMetadata): boolean {
  return actor.teacherScope.teaching.classSubjectIds.length > 0
    || actor.teacherScope.homeroom.classGroupIds.length > 0
}

function assertTeacherPermissionAction(
  actor: TeacherActorMetadata,
  permission: Permission,
  scope?: Pick<AuthorizationRequest, 'scopeType' | 'scopeEntityId'>,
): void {
  const teachingTarget = teachingTargetFromAuthorizationScope(scope)
  const homeroomTarget = homeroomTargetFromAuthorizationScope(scope)
  const teachingCapability = teachingCapabilityForPermission(permission)
  const homeroomCapability = homeroomCapabilityForPermission(permission)

  if (teachingCapability && homeroomCapability) {
    try {
      assertTeachingCapability(actor, teachingCapability, teachingTarget)
      return
    }
    catch {
      // Teaching scope miss; homeroom may still authorize the same permission.
    }
    assertHomeroomCapability(actor, homeroomCapability, homeroomTarget)
    return
  }

  if (teachingCapability) {
    assertTeachingCapability(actor, teachingCapability, teachingTarget)
    return
  }

  if (homeroomCapability) {
    assertHomeroomCapability(actor, homeroomCapability, homeroomTarget)
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

function assertPortalPermissionAction(
  actor: ActorMetadata,
  permission: Permission,
  scope?: Pick<AuthorizationRequest, 'scopeType' | 'scopeEntityId'>,
): void {
  const target = capabilityTargetFromAuthorizationScope(scope)

  if (actor.kind === 'guardian') {
    const capability = guardianCapabilityForPermission(permission)
    if (!capability) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    assertGuardianCapability(actor, capability, target)
    return
  }

  if (actor.kind === 'student') {
    const capability = studentCapabilityForPermission(permission)
    if (!capability) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    assertStudentCapability(actor, capability, target)
    return
  }

  if (actor.kind === 'teacher') {
    assertTeacherPermissionAction(actor, permission, scope)
  }
}

export function permissionAction(
  permission: Permission,
  scope?: Pick<AuthorizationRequest, 'scopeType' | 'scopeEntityId'>,
): (actor: ActorMetadata) => void {
  return (actor) => {
    if (actor.kind === 'guardian' || actor.kind === 'student' || actor.kind === 'teacher') {
      assertPortalPermissionAction(actor, permission, scope)
      return
    }

    authorize({
      actor,
      request: {
        schoolId: actor.schoolId,
        permission,
        ...scope,
      },
    })
  }
}

export function anyPermissionAction(
  permissions: readonly Permission[],
  scope?: Pick<AuthorizationRequest, 'scopeType' | 'scopeEntityId'>,
): (actor: ActorMetadata) => void {
  if (permissions.length === 0) {
    throw new Error('anyPermissionAction requires at least one permission')
  }

  return (actor) => {
    let lastError: unknown
    for (const permission of permissions) {
      try {
        permissionAction(permission, scope)(actor)
        return
      }
      catch (error) {
        lastError = error
      }
    }
    throw lastError
  }
}

export function read<T>(
  checkModule: (actor: ActorMetadata) => void | Promise<void>,
  checkAccess: EntityReadAuthorization<T>['checkAccess'],
): EntityReadAuthorization<T> {
  return { checkModule, checkAccess }
}

export function write<T>(
  checkModule: (actor: ActorMetadata) => void | Promise<void>,
  authorizeSave: EntityWriteAuthorization<T>['authorizeSave'],
  authorizeDelete: EntityWriteAuthorization<T>['authorizeDelete'],
): EntityWriteAuthorization<T> {
  return { checkModule, authorizeSave, authorizeDelete }
}

export async function noopReadAccess(): Promise<void> {}
export async function noopSaveAccess(): Promise<void> {}
export async function noopDeleteAccess(): Promise<void> {}

export function readByIds<T extends { id: string }>(
  checkIds: (actor: ActorMetadata, ids: readonly string[]) => Promise<void>,
): EntityReadAuthorization<T>['checkAccess'] {
  return async (actor, entities) => {
    await checkIds(actor, unique(entities.map(entity => entity.id)))
  }
}

export function authorizeExistingById<T extends { id: string }>(
  readAccess: EntityReadAuthorization<T>['checkAccess'],
): EntityWriteAuthorization<T>['authorizeSave'] {
  return async (actor, entity, existing, repositories) => {
    await readAccess(actor, [entity], repositories)
    if (existing)
      await readAccess(actor, [existing], repositories)
  }
}

export function authorizeDeleteByReadAccess<T>(
  readAccess: EntityReadAuthorization<T>['checkAccess'],
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return async (actor, entity, repositories) => {
    await readAccess(actor, [entity], repositories)
  }
}

export function authorizeClassGroupLinked<T extends { classGroupId: string }>(
  policy: AuthorizationPolicy,
  field: keyof T,
): EntityWriteAuthorization<T>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkClassGroupAccess(actor, [entity[field] as string])
  }
}

export function teacherScopeAction(
  check: (actor: TeacherActorMetadata) => void,
): (actor: ActorMetadata) => void {
  return (actor) => {
    if (actor.kind !== 'teacher') {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    check(actor)
  }
}

export function teacherWithAssignmentAction(): (actor: ActorMetadata) => void {
  return teacherScopeAction((actor) => {
    if (!teacherHasAnyAssignment(actor)) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  })
}

export function gradeInputWriteModule(): (actor: ActorMetadata) => void {
  return (actor) => {
    if (actor.kind === 'teacher') {
      teacherWithAssignmentAction()(actor)
      return
    }
    permissionAction(Permission.GRADE_INPUT)(actor)
  }
}

export function assessmentWriteModule(): (actor: ActorMetadata) => void {
  return gradeInputWriteModule()
}

export function attendanceRecordWriteModule(): (actor: ActorMetadata) => void {
  return (actor) => {
    if (actor.kind === 'teacher') {
      teacherWithAssignmentAction()(actor)
      return
    }
    permissionAction(Permission.ATTENDANCE_RECORD)(actor)
  }
}

export function disciplineReadModule(): (actor: ActorMetadata) => void {
  return (actor) => {
    if (actor.kind === 'teacher') {
      teacherWithAssignmentAction()(actor)
      return
    }
    permissionAction(Permission.DISCIPLINE_READ)(actor)
  }
}

export function disciplineCreateModule(): (actor: ActorMetadata) => void {
  return (actor) => {
    if (actor.kind === 'teacher') {
      teacherWithAssignmentAction()(actor)
      return
    }
    permissionAction(Permission.DISCIPLINE_CREATE)(actor)
  }
}

export function authorizeTeacherAssessmentSave(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<{ classGroupId: string, classSubjectId: string }>['authorizeSave'] {
  return async (actor, entity, existing) => {
    if (actor.kind === 'teacher') {
      assertTeachingCapability(
        actor,
        existing ? TeachingCapability.UpdateSubjectAssessment : TeachingCapability.CreateSubjectAssessment,
        { classSubjectId: entity.classSubjectId },
      )
      return
    }
    await policy.checkClassGroupAccess(actor, [entity.classGroupId])
  }
}

export function authorizeTeacherAssessmentDelete(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<{ classGroupId: string, classSubjectId: string }>['authorizeDelete'] {
  return async (actor, entity) => {
    if (actor.kind === 'teacher') {
      assertTeachingCapability(actor, TeachingCapability.UpdateSubjectAssessment, {
        classSubjectId: entity.classSubjectId,
      })
      return
    }
    await policy.checkClassGroupAccess(actor, [entity.classGroupId])
  }
}

export function reportCardCommentWriteModule(): (actor: ActorMetadata) => void {
  return (actor) => {
    if (actor.kind === 'teacher') {
      teacherWithAssignmentAction()(actor)
      return
    }
    permissionAction(Permission.REPORT_CARD_PUBLISH)(actor)
  }
}

export function reportCardReadModule(): (actor: ActorMetadata) => void {
  return (actor) => {
    if (actor.kind === 'teacher') {
      teacherWithAssignmentAction()(actor)
      return
    }
    permissionAction(Permission.QUERY_REPORT_CARD_DETAIL_READ)(actor)
  }
}

export function attachmentReadModule(): (actor: ActorMetadata) => void {
  return (actor) => {
    if (actor.kind === 'teacher') {
      teacherWithAssignmentAction()(actor)
      return
    }
    permissionAction(Permission.ATTACHMENT_READ)(actor)
  }
}

export function workspaceReadModule(): (actor: ActorMetadata) => void {
  return (actor) => {
    if (actor.kind === 'teacher') {
      teacherWithAssignmentAction()(actor)
      return
    }
    permissionAction(Permission.QUERY_WORKSPACE_READ)(actor)
  }
}

export function teacherSelfReadModule(): (actor: ActorMetadata) => void {
  return (actor) => {
    if (actor.kind === 'teacher') {
      return
    }
    anyPermissionAction([
      Permission.ACCESS_CONTROL_ASSIGN,
      Permission.SCHOOL_STRUCTURE_CONFIGURE,
    ])(actor)
  }
}

export function teacherAssignmentReadModule(): (actor: ActorMetadata) => void {
  return (actor) => {
    if (actor.kind === 'teacher') {
      teacherWithAssignmentAction()(actor)
      return
    }
    anyPermissionAction([
      Permission.ACCESS_CONTROL_ASSIGN,
      Permission.SCHOOL_STRUCTURE_CONFIGURE,
    ])(actor)
  }
}

export function authorizeClassGroupLinkedDelete<T extends { classGroupId: string }>(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkClassGroupAccess(actor, [entity.classGroupId])
  }
}
