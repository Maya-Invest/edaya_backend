import type { EntityReadAuthorization, EntityWriteAuthorization } from '../../../application/entities/managed-entity-service'
import type { SchoolRepositories } from '../../../ports'
import type { ActorMetadata } from '../model/actor'
import { unique } from '../../../application/entities/entity-config/helper-utils'

function normalizeIds(ids: string | readonly string[]): readonly string[] {
  return typeof ids === 'string' ? [ids] : [...ids]
}

export function resourceGate<T>(
  check: (actor: ActorMetadata, ids: readonly string[], repositories: SchoolRepositories) => Promise<void>,
  selectIds: (entity: T) => string | readonly string[],
): EntityReadAuthorization<T>['checkAccess'] {
  return async (actor, entities, repositories) => {
    const ids = unique(entities.flatMap(entity => [...normalizeIds(selectIds(entity))]))
    if (ids.length === 0) {
      return
    }
    await check(actor, ids, repositories)
  }
}

export function resourceGateForSave<T>(
  check: (actor: ActorMetadata, ids: readonly string[], repositories: SchoolRepositories) => Promise<void>,
  resolveIds: (
    entity: T,
    existing: T | undefined,
    repositories: SchoolRepositories,
  ) => Promise<readonly string[]> | readonly string[],
): EntityWriteAuthorization<T>['authorizeSave'] {
  return async (actor, entity, existing, repositories) => {
    const ids = unique([...normalizeIds(await resolveIds(entity, existing, repositories))])
    if (ids.length === 0) {
      return
    }
    await check(actor, ids, repositories)
  }
}

export function resourceGateForDelete<T>(
  check: (actor: ActorMetadata, ids: readonly string[], repositories: SchoolRepositories) => Promise<void>,
  resolveIds: (entity: T, repositories: SchoolRepositories) => Promise<readonly string[]> | readonly string[],
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return async (actor, entity, repositories) => {
    const ids = unique([...normalizeIds(await resolveIds(entity, repositories))])
    if (ids.length === 0) {
      return
    }
    await check(actor, ids, repositories)
  }
}
