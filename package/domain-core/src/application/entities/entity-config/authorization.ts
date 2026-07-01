import type { ActorMetadata, AuthorizationPolicy, AuthorizationRequest, Permission } from '../../authorization'
import type { EntityReadAuthorization, EntityWriteAuthorization } from '../../services'
import { authorize } from '../../authorization'
import { unique } from '../utils/helper-utils'

export function permissionAction(
  permission: Permission,
  scope?: Pick<AuthorizationRequest, 'scopeType' | 'scopeEntityId'>,
): (actor: ActorMetadata) => void {
  return (actor) => {
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

export function authorizeClassGroupLinkedDelete<T extends { classGroupId: string }>(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkClassGroupAccess(actor, [entity.classGroupId])
  }
}
