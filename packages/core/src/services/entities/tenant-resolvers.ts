import type { Filter, QueryOptions, SchoolRepositories } from '../../ports'
import type { EntityTenantResolver } from './managed-entity-service'

interface EntityWithSchoolId {
  schoolId?: string
}

interface EntityWithId {
  id: string
}

export function directSchoolTenant<T extends EntityWithSchoolId>(): EntityTenantResolver<T> {
  return {
    resolve: entity => entity.schoolId,
    resolveFromFilter: resolveSchoolIdFromFilter,
  }
}

export function schoolEntityTenant<T extends EntityWithId>(): EntityTenantResolver<T> {
  return {
    resolve: entity => entity.id,
    resolveFromFilter: resolveIdFromFilter,
  }
}

export function indirectTenant<T>(
  resolve: (entity: T, repositories: SchoolRepositories) => Promise<string | undefined> | string | undefined,
): EntityTenantResolver<T> {
  return { resolve }
}

export function resolveSchoolIdFromFilter<T>(filter: Filter<T> | QueryOptions<T> | undefined): string | undefined {
  return resolveStringFilterValue((filter as { schoolId?: unknown } | undefined)?.schoolId)
}

function resolveIdFromFilter<T>(filter: Filter<T> | QueryOptions<T> | undefined): string | undefined {
  return resolveStringFilterValue((filter as { id?: unknown } | undefined)?.id)
}

function resolveStringFilterValue(value: unknown): string | undefined {
  if (typeof value === 'string')
    return value
  if (!value || typeof value !== 'object')
    return undefined

  const fieldFilter = value as { $eq?: unknown, $in?: unknown }
  if (typeof fieldFilter.$eq === 'string')
    return fieldFilter.$eq
  if (Array.isArray(fieldFilter.$in) && typeof fieldFilter.$in[0] === 'string')
    return fieldFilter.$in[0]
  return undefined
}
