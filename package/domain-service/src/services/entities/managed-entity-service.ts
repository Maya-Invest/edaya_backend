import type { ActorMetadata } from '@edaya/authorization'
import type {
  AtomicExecutionPort,
  BaseRepositoryInterface,
  EntityReadAuthorization as CoreEntityReadAuthorization,
  EntityWriteAuthorization as CoreEntityWriteAuthorization,
  Filter,
  QueryOptions,
} from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { AuthorizationError, AuthorizationErrorCode } from '@edaya/authorization'
import { withTenantLookupCache } from './tenant-lookup-cache'

export interface EntityTenantResolver<T> {
  resolve: (entity: T, repositories: SchoolRepositories) => Promise<string | undefined> | string | undefined
  resolveFromFilter?: (filter: Filter<T> | QueryOptions<T> | undefined) => string | undefined
  scopeFilter?: (schoolId: string, repositories: SchoolRepositories) => Filter<T> | Promise<Filter<T>>
}

export type EntityReadAuthorization<T> = CoreEntityReadAuthorization<T, ActorMetadata>
export type EntityWriteAuthorization<T> = CoreEntityWriteAuthorization<T, ActorMetadata>

export interface EntityBusinessGates<T> {
  preSave?: (
    entity: T,
    existing: T | undefined,
    repositories: SchoolRepositories,
    actor: ActorMetadata,
  ) => Promise<void>
  preDelete?: (
    entity: T,
    repositories: SchoolRepositories,
  ) => Promise<void>
}

export interface EntityBusinessHooks<T> {
  postSave?: (
    entity: T,
    existing: T | undefined,
    repositories: SchoolRepositories,
    actor: ActorMetadata,
  ) => Promise<void>
  postDelete?: (
    entity: T,
    repositories: SchoolRepositories,
    actor: ActorMetadata,
  ) => Promise<void>
}

export interface ManagedEntityServiceConfig<T> {
  repository: BaseRepositoryInterface<T>
  tenant: EntityTenantResolver<T>
  read: EntityReadAuthorization<T>
  write: EntityWriteAuthorization<T>
  gates?: EntityBusinessGates<T>
  hooks?: EntityBusinessHooks<T>
  atomicExecution?: AtomicExecutionPort
}

export interface ManagedEntityServiceArgs<T> {
  actor: ActorMetadata
  repositories: SchoolRepositories
  config: ManagedEntityServiceConfig<T>
}

export interface ManagedEntityWriteOptions {
  moduleChecked?: boolean
}

export class ManagedEntityService<T> {
  private readonly actor: ActorMetadata
  private readonly repositories: SchoolRepositories
  private readonly config: ManagedEntityServiceConfig<T>
  private boundRepository?: BaseRepositoryInterface<T>

  constructor(args: ManagedEntityServiceArgs<T>) {
    this.actor = args.actor
    this.repositories = args.repositories
    this.config = args.config
  }

  private get scopedRepository(): BaseRepositoryInterface<T> {
    return this.boundRepository ??= this.config.repository.forSchool?.(this.actor.schoolId) ?? this.config.repository
  }

  async findById(id: string): Promise<T | undefined> {
    await this.config.read.checkModule(this.actor)
    const entity = await this.scopedRepository.findById(id)
    if (!entity)
      return undefined
    await this.ensureEntityTenant(entity)
    await this.config.read.checkAccess(this.actor, [entity], this.repositories)
    return entity
  }

  async findByIds(ids: readonly string[]): Promise<T[]> {
    await this.config.read.checkModule(this.actor)
    const entities = await this.scopedRepository.findByIds(ids)
    await this.ensureEntitiesTenant(entities)
    await this.config.read.checkAccess(this.actor, entities, this.repositories)
    return entities
  }

  async findOne(options?: QueryOptions<T>): Promise<T | undefined> {
    this.ensureFilterTenant(options)
    await this.config.read.checkModule(this.actor)
    const entity = await this.scopedRepository.findOne(await this.scopeQuery(options))
    if (!entity)
      return undefined
    await this.ensureEntityTenant(entity)
    await this.config.read.checkAccess(this.actor, [entity], this.repositories)
    return entity
  }

  async list(options?: QueryOptions<T>): Promise<T[]> {
    this.ensureFilterTenant(options)
    await this.config.read.checkModule(this.actor)
    const entities = await this.scopedRepository.list(await this.scopeQuery(options))
    await this.ensureEntitiesTenant(entities)
    await this.config.read.checkAccess(this.actor, entities, this.repositories)
    return entities
  }

  async count(filter?: Filter<T>): Promise<number> {
    this.ensureFilterTenant(filter)
    await this.config.read.checkModule(this.actor)

    const scopedFilter = await this.scopeQuery(filter)
    // Elevation does not remove tenant boundaries. The SQL shortcut is safe
    // only when the configuration supplies an independent tenant predicate.
    if ((this.config.repository.forSchool || this.config.tenant.scopeFilter) && canCountWithoutRowAccess(this.actor)) {
      return this.scopedRepository.count(scopedFilter)
    }

    const entities = await this.scopedRepository.list(scopedFilter)
    await this.ensureEntitiesTenant(entities)
    await this.config.read.checkAccess(this.actor, entities, this.repositories)
    return entities.length
  }

  async save(entity: T, options: ManagedEntityWriteOptions = {}): Promise<void> {
    return this.executeWrite(async () => {
      await this.ensureEntityTenant(entity)
      if (!options.moduleChecked)
        await this.config.write.checkModule(this.actor)

      const id = getEntityId(entity)
      const existing = id ? await this.config.repository.findById(id) : undefined
      if (existing)
        await this.ensureEntityTenant(existing)

      await this.config.write.authorizeSave(this.actor, entity, existing, this.repositories)
      await this.config.gates?.preSave?.(entity, existing, this.repositories, this.actor)
      await this.scopedRepository.save(entity)
      await this.config.hooks?.postSave?.(entity, existing, this.repositories, this.actor)
    })
  }

  async batchSave(entities: T[], options: ManagedEntityWriteOptions = {}): Promise<string[]> {
    return this.executeWrite(async () => {
      await this.ensureEntitiesTenant(entities)
      if (!options.moduleChecked)
        await this.config.write.checkModule(this.actor)

      const ids = entities.map(getEntityId).filter((id): id is string => id !== undefined)
      const existingEntities = ids.length > 0 ? await this.config.repository.findByIds(ids) : []
      await this.ensureEntitiesTenant(existingEntities)
      const existingById = new Map(existingEntities.map(entity => [getEntityId(entity), entity]))

      for (const entity of entities) {
        const id = getEntityId(entity)
        const existing = id ? existingById.get(id) : undefined
        await this.config.write.authorizeSave(this.actor, entity, existing, this.repositories)
        await this.config.gates?.preSave?.(entity, existing, this.repositories, this.actor)
      }

      const savedIds = await this.scopedRepository.batchSave(entities)

      for (const entity of entities) {
        const id = getEntityId(entity)
        const existing = id ? existingById.get(id) : undefined
        await this.config.hooks?.postSave?.(entity, existing, this.repositories, this.actor)
      }

      return savedIds
    })
  }

  async delete(id: string, options: ManagedEntityWriteOptions = {}): Promise<void> {
    return this.executeWrite(async () => {
      if (!options.moduleChecked)
        await this.config.write.checkModule(this.actor)
      const entity = await this.config.repository.findById(id)
      if (!entity)
        return

      await this.ensureEntityTenant(entity)
      await this.config.write.authorizeDelete(this.actor, entity, this.repositories)
      await this.config.gates?.preDelete?.(entity, this.repositories)
      await this.scopedRepository.delete(id)
      await this.config.hooks?.postDelete?.(entity, this.repositories, this.actor)
    })
  }

  async batchDelete(ids: string[], options: ManagedEntityWriteOptions = {}): Promise<void> {
    return this.executeWrite(async () => {
      if (!options.moduleChecked)
        await this.config.write.checkModule(this.actor)
      const entities = await this.config.repository.findByIds(ids)
      if (entities.length === 0)
        return

      await this.ensureEntitiesTenant(entities)
      for (const entity of entities) {
        await this.config.write.authorizeDelete(this.actor, entity, this.repositories)
        await this.config.gates?.preDelete?.(entity, this.repositories)
      }

      const existingIds = entities.map(getEntityId).filter((id): id is string => id !== undefined)
      await this.scopedRepository.batchDelete(existingIds)

      for (const entity of entities) {
        await this.config.hooks?.postDelete?.(entity, this.repositories, this.actor)
      }
    })
  }

  private async executeWrite<R>(operation: () => Promise<R>): Promise<R> {
    if (this.config.atomicExecution)
      return this.config.atomicExecution.execute(operation)
    return operation()
  }

  private ensureFilterTenant(filter: Filter<T> | QueryOptions<T> | undefined): void {
    const schoolId = this.config.tenant.resolveFromFilter?.(filter)
    if (schoolId && schoolId !== this.actor.schoolId)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  private async scopeQuery(options?: QueryOptions<T>): Promise<QueryOptions<T> | undefined> {
    if (this.config.repository.forSchool || !this.config.tenant.scopeFilter)
      return options
    const scope = await this.config.tenant.scopeFilter(this.actor.schoolId, this.repositories)
    const { $limit, $offset, $orderBy, ...filter } = options ?? {}
    return {
      $and: [scope, filter as Filter<T>],
      ...($limit !== undefined ? { $limit } : {}),
      ...($offset !== undefined ? { $offset } : {}),
      ...($orderBy !== undefined ? { $orderBy } : {}),
    } as QueryOptions<T>
  }

  private async ensureEntitiesTenant(entities: readonly T[]): Promise<void> {
    if (entities.length === 0) {
      return
    }

    const repositories = withTenantLookupCache(this.repositories)
    for (const entity of entities) {
      await this.ensureEntityTenant(entity, repositories)
    }
  }

  private async ensureEntityTenant(
    entity: T,
    repositories: SchoolRepositories = this.repositories,
  ): Promise<void> {
    const schoolId = await this.config.tenant.resolve(entity, repositories)
    if (!schoolId || schoolId !== this.actor.schoolId)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

export function getEntityId(entity: unknown): string | undefined {
  const id = (entity as { id?: unknown } | undefined)?.id
  return typeof id === 'string' ? id : undefined
}

function canCountWithoutRowAccess(actor: ActorMetadata): boolean {
  if (actor.kind === 'system') {
    return true
  }
  return actor.kind === 'staff' && actor.effectiveGrants.isElevated
}
