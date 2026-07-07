import type { EntityReadAuthorization, EntityWriteAuthorization } from '../../../application/entities/managed-entity-service'
import type { ActorMetadata, AuthorizationPolicy } from '../../../capabilities/authorization'
import { unique } from './helper-utils'

export {
  anyOperationModule,
  authorizeDeleteWithOperation,
  authorizeSaveWithOperation,
  operationModule,
  resourceGate,
  resourceGateForDelete,
  resourceGateForSave,
} from '../../../capabilities/authorization/gates'

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
