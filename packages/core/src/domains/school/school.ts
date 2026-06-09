import type { BaseRepositoryInterface } from '../../ports/base-repository'
import type { EntityTenantResolver, ManagedEntityServiceConfig } from '../../services/managed-entity-service'
import type { EntityConfigFactory, EntityConfigFactoryInput, EntityWithId } from '../../shared'
import { z } from 'zod'
import { Permission } from '../../authorization'
import { config, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, resolveIdFromFilter, write } from '../../shared'
import { DomainValidationError, formatZodError, zodDate } from '../utils'

export enum SchoolType {
  Primary = 'primary',
  Secondary = 'secondary',
  K12 = 'k12',
  Vocational = 'vocational',
  Other = 'other',
}

export const schoolSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  timeZone: z.string().trim().min(1, 'timeZone must not be blank').refine((val) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: val }).format()
      return true
    }
    catch {
      return false
    }
  }, val => ({ message: `Invalid IANA time zone: ${val}` })),
  ownerStaffId: z.string().trim().min(1, 'ownerStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  type: z.nativeEnum(SchoolType).nullable().optional().transform(v => v === null ? undefined : v),
  country: z.string().trim().min(1, 'country must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  city: z.string().trim().min(1, 'city must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type SchoolData = z.infer<typeof schoolSchema>

export const schoolCreateSchema = schoolSchema.omit({ createdAt: true })
export const schoolUpdateSchema = schoolSchema.partial().required({ id: true })

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
  readonly data: SchoolData

  constructor(args: SchoolArgs) {
    const result = schoolSchema.safeParse(args)
    if (!result.success) {
      throw new DomainValidationError(formatZodError(result.error))
    }
    this.data = result.data
  }

  get id() { return this.data.id }
  get name() { return this.data.name }
  get timeZone() { return this.data.timeZone }
  get ownerStaffId() { return this.data.ownerStaffId }
  get type() { return this.data.type }
  get country() { return this.data.country }
  get city() { return this.data.city }
  get createdAt() { return this.data.createdAt }

  get location(): string | undefined {
    const parts = [this.city, this.country].filter((value): value is string => Boolean(value))
    return parts.length > 0 ? parts.join(', ') : undefined
  }
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
