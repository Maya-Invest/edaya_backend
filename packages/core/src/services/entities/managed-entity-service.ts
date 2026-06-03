import type { AtomicExecutionPort, BaseRepositoryInterface, Filter, QueryOptions, SchoolRepositories } from '../../ports'
import type { ActorMetadata } from '../authorization'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization'

export interface EntityTenantResolver<T> {
  resolve: (entity: T, repositories: SchoolRepositories) => Promise<string | undefined> | string | undefined
  resolveFromFilter?: (filter: Filter<T> | QueryOptions<T> | undefined) => string | undefined
}

export interface EntityReadAuthorization<T> {
  checkModule: (actor: ActorMetadata) => Promise<void>
  checkAccess: (
    actor: ActorMetadata,
    entities: readonly T[],
    repositories: SchoolRepositories,
  ) => Promise<void>
}

export interface EntityWriteAuthorization<T> {
  checkModule: (actor: ActorMetadata) => Promise<void>
  authorizeSave: (
    actor: ActorMetadata,
    entity: T,
    existing: T | undefined,
    repositories: SchoolRepositories,
  ) => Promise<void>
  authorizeDelete: (
    actor: ActorMetadata,
    entity: T,
    repositories: SchoolRepositories,
  ) => Promise<void>
}

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

export interface ManagedEntityServiceConfig<T> {
  repository: BaseRepositoryInterface<T>
  tenant: EntityTenantResolver<T>
  read: EntityReadAuthorization<T>
  write: EntityWriteAuthorization<T>
  gates?: EntityBusinessGates<T>
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

  constructor(args: ManagedEntityServiceArgs<T>) {
    this.actor = args.actor
    this.repositories = args.repositories
    this.config = args.config
  }

  async findById(id: string): Promise<T | undefined> {
    await this.config.read.checkModule(this.actor)
    const entity = await this.config.repository.findById(id)
    if (!entity)
      return undefined
    await this.ensureEntityTenant(entity)
    await this.config.read.checkAccess(this.actor, [entity], this.repositories)
    return entity
  }

  async findByIds(ids: string[]): Promise<T[]> {
    await this.config.read.checkModule(this.actor)
    const entities = await this.config.repository.findByIds(ids)
    await this.ensureEntitiesTenant(entities)
    await this.config.read.checkAccess(this.actor, entities, this.repositories)
    return entities
  }

  async findOne(options?: QueryOptions<T>): Promise<T | undefined> {
    this.ensureFilterTenant(options)
    await this.config.read.checkModule(this.actor)
    const entity = await this.config.repository.findOne(options)
    if (!entity)
      return undefined
    await this.ensureEntityTenant(entity)
    await this.config.read.checkAccess(this.actor, [entity], this.repositories)
    return entity
  }

  async list(options?: QueryOptions<T>): Promise<T[]> {
    this.ensureFilterTenant(options)
    await this.config.read.checkModule(this.actor)
    const entities = await this.config.repository.list(options)
    await this.ensureEntitiesTenant(entities)
    await this.config.read.checkAccess(this.actor, entities, this.repositories)
    return entities
  }

  async count(filter?: Filter<T>): Promise<number> {
    this.ensureFilterTenant(filter)
    await this.config.read.checkModule(this.actor)
    return this.config.repository.count(filter)
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
      await this.config.repository.save(entity)
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

      return this.config.repository.batchSave(entities)
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
      await this.config.repository.delete(id)
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
      await this.config.repository.batchDelete(existingIds)
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

  private async ensureEntitiesTenant(entities: readonly T[]): Promise<void> {
    for (const entity of entities) {
      await this.ensureEntityTenant(entity)
    }
  }

  private async ensureEntityTenant(entity: T): Promise<void> {
    const schoolId = await this.config.tenant.resolve(entity, this.repositories)
    if (schoolId && schoolId !== this.actor.schoolId)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

export function getEntityId(entity: unknown): string | undefined {
  const id = (entity as { id?: unknown } | undefined)?.id
  return typeof id === 'string' ? id : undefined
}
