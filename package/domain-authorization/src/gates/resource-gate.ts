import type { CoreEntityRepositories, EntityReadAuthorization, EntityWriteAuthorization } from '@edaya/core'
import type { ActorMetadata } from '../model/actor'
import { unique } from '@edaya/core'

function normalizeIds(ids: string | readonly string[]): readonly string[] {
  return typeof ids === 'string' ? [ids] : [...ids]
}

export function resourceGate<T>(
  check: (actor: ActorMetadata, ids: readonly string[], repositories: CoreEntityRepositories) => Promise<void>,
  selectIds: (entity: T) => string | readonly string[],
): EntityReadAuthorization<T, ActorMetadata>['checkAccess'] {
  return async (actor, entities, repositories) => {
    const ids = unique(entities.flatMap(entity => [...normalizeIds(selectIds(entity))]))
    if (ids.length === 0) {
      return
    }
    await check(actor, ids, repositories)
  }
}

export function resourceGateForSave<T>(
  check: (actor: ActorMetadata, ids: readonly string[], repositories: CoreEntityRepositories) => Promise<void>,
  resolveIds: (
    entity: T,
    existing: T | undefined,
    repositories: CoreEntityRepositories,
  ) => Promise<readonly string[]> | readonly string[],
): EntityWriteAuthorization<T, ActorMetadata>['authorizeSave'] {
  return async (actor, entity, existing, repositories) => {
    const ids = unique([...normalizeIds(await resolveIds(entity, existing, repositories))])
    if (ids.length === 0) {
      return
    }
    await check(actor, ids, repositories)
  }
}

export function resourceGateForDelete<T>(
  check: (actor: ActorMetadata, ids: readonly string[], repositories: CoreEntityRepositories) => Promise<void>,
  resolveIds: (entity: T, repositories: CoreEntityRepositories) => Promise<readonly string[]> | readonly string[],
): EntityWriteAuthorization<T, ActorMetadata>['authorizeDelete'] {
  return async (actor, entity, repositories) => {
    const ids = unique([...normalizeIds(await resolveIds(entity, repositories))])
    if (ids.length === 0) {
      return
    }
    await check(actor, ids, repositories)
  }
}
