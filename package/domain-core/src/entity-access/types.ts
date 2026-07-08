import type { Filter, QueryOptions } from '../ports'
import type { CoreEntityRepositories } from '../ports/repositories/school-repositories'

export interface EntityTenantResolver<T> {
  resolve: (entity: T, repositories: CoreEntityRepositories) => Promise<string | undefined> | string | undefined
  resolveFromFilter?: (filter: Filter<T> | QueryOptions<T> | undefined) => string | undefined
}

export interface EntityReadAuthorization<T, TActor = unknown> {
  checkModule: (actor: TActor) => void | Promise<void>
  checkAccess: (
    actor: TActor,
    entities: readonly T[],
    repositories: CoreEntityRepositories,
  ) => Promise<void>
}

export interface EntityWriteAuthorization<T, TActor = unknown> {
  checkModule: (actor: TActor) => void | Promise<void>
  authorizeSave: (
    actor: TActor,
    entity: T,
    existing: T | undefined,
    repositories: CoreEntityRepositories,
  ) => Promise<void>
  authorizeDelete: (
    actor: TActor,
    entity: T,
    repositories: CoreEntityRepositories,
  ) => Promise<void>
}
