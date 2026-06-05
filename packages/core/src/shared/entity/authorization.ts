import type { ActorMetadata, AuthorizationPolicy } from '../../authorization'
import type { AuthorizationRequest } from '../../authorization/authorization-request'
import type { Permission } from '../../authorization/permissions'
import type { EntityReadAuthorization, EntityWriteAuthorization } from '../../services'
import { authorize } from '../../authorization/authorize'
import { unique } from '../utils/helper-utils'

/** Prefer for new code once call sites pass school context on the actor. */
export function permissionAction(
  policy: AuthorizationPolicy,
  permission: Permission,
  scope?: Pick<AuthorizationRequest, 'scopeType' | 'scopeEntityId' | 'academicYearId'>,
): (actor: ActorMetadata) => Promise<void> {
  return async (actor) => {
    const actorId = actor.kind === 'staff'
      ? actor.staffMemberId
      : actor.kind === 'guardian'
        ? actor.guardianId
        : actor.kind === 'student'
          ? actor.studentId
          : actor.systemId

    await authorize({
      actor,
      policy,
      repositories: policy.getRepositories?.(),
      request: {
        actorId,
        schoolId: actor.schoolId,
        permission,
        ...scope,
      },
    })
  }
}

export function anyPermissionAction(
  policy: AuthorizationPolicy,
  permissions: readonly Permission[],
  scope?: Pick<AuthorizationRequest, 'scopeType' | 'scopeEntityId' | 'academicYearId'>,
): (actor: ActorMetadata) => Promise<void> {
  if (permissions.length === 0) {
    throw new Error('anyPermissionAction requires at least one permission')
  }

  return async (actor) => {
    let lastError: unknown
    for (const permission of permissions) {
      try {
        await permissionAction(policy, permission, scope)(actor)
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
  checkModule: (actor: ActorMetadata) => Promise<void>,
  checkAccess: EntityReadAuthorization<T>['checkAccess'],
): EntityReadAuthorization<T> {
  return { checkModule, checkAccess }
}

export function write<T>(
  checkModule: (actor: ActorMetadata) => Promise<void>,
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

export function authorizeClassGroupLinkedDelete<T extends { classGroupId: string }>(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkClassGroupAccess(actor, [entity.classGroupId])
  }
}

export function authorizeAnnouncementLinked<T extends { announcementId: string }>(
  _policy: AuthorizationPolicy,
  _field: keyof T,
): EntityWriteAuthorization<T>['authorizeSave'] {
  return noopSaveAccess
}

export function authorizeAnnouncementLinkedDelete<T extends { announcementId: string }>(
  _policy: AuthorizationPolicy,
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return noopDeleteAccess
}
