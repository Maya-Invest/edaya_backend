import type { BaseRepositoryInterface } from '../../ports/base-repository'
import type { EntityTenantResolver, ManagedEntityServiceConfig } from '../../services/managed-entity-service'
import type { EntityConfigFactory, EntityConfigFactoryInput, EntityWithId } from '../../shared'
import { Permission } from '../../authorization'
import { config, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, resolveIdFromFilter, write } from '../../shared'
import { requireNonBlank, requireOptionalNonBlank } from '../utils'

export enum SchoolType {
  Primary = 'primary',
  Secondary = 'secondary',
  K12 = 'k12',
  Vocational = 'vocational',
  Other = 'other',
}

export interface SchoolArgs {
  id: string
  name: string
  timeZone: string
  ownerStaffId?: string | null
  type?: SchoolType | null
  country?: string | null
  city?: string | null
  createdAt?: Date
}

/**
 * Represents the primary educational institution entity.
 * Serves as the root boundary for all other domain entities.
 */
export class School {
  readonly id: string
  readonly name: string
  readonly timeZone: string
  readonly ownerStaffId?: string
  readonly type?: SchoolType
  readonly country?: string
  readonly city?: string
  readonly createdAt: Date

  constructor({ id, name, timeZone, ownerStaffId, type, country, city, createdAt }: SchoolArgs) {
    this.id = requireNonBlank(id, 'id')
    this.name = requireNonBlank(name, 'name')
    this.timeZone = requireTimeZone(timeZone)
    this.ownerStaffId = requireOptionalNonBlank(ownerStaffId, 'ownerStaffId')
    this.type = type ?? undefined
    this.country = requireOptionalNonBlank(country, 'country')
    this.city = requireOptionalNonBlank(city, 'city')
    this.createdAt = createdAt ?? new Date()
  }

  get location(): string | undefined {
    const parts = [this.city, this.country].filter((value): value is string => Boolean(value))
    return parts.length > 0 ? parts.join(', ') : undefined
  }
}

function requireTimeZone(value: string): string {
  const timeZone = requireNonBlank(value, 'timeZone')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
  }
  catch {
    throw new Error(`Invalid IANA time zone: ${timeZone}`)
  }
  return timeZone
}

export const schoolConfig: EntityConfigFactory<School> = input =>
  schoolEntityConfig(input, input.repositories.schools, Permission.QUERY_WORKSPACE_READ, Permission.SCHOOL_LIFECYCLE_MANAGE)

export function schoolEntityTenant<T extends EntityWithId>(): EntityTenantResolver<T> {
  return {
    resolve: entity => entity.id,
    resolveFromFilter: resolveIdFromFilter,
  }
}

export function schoolEntityConfig<T extends EntityWithId>(
  input: EntityConfigFactoryInput,
  repository: BaseRepositoryInterface<T>,
  readPermission: Permission,
  writePermission: Permission,
): ManagedEntityServiceConfig<T> {
  const { policy, atomicExecution } = input

  return config({
    repository,
    tenant: schoolEntityTenant<T>(),
    read: read(permissionAction(policy, readPermission), noopReadAccess),
    write: write(permissionAction(policy, writePermission), noopSaveAccess, noopDeleteAccess),
    atomicExecution,
  })
}
