import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { AtomicExecutionPort, BaseRepositoryInterface, CoreEntityKey, CoreEntityMap, Filter, QueryOptions } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { AuthorizationError, AuthorizationErrorCode, createAccessPolicies } from '@edaya/authorization'

export interface EntityTenantResolver<T> {
  resolve: (entity: T, repositories: SchoolRepositories) => Promise<string | undefined> | string | undefined
  resolveFromFilter?: (filter: Filter<T> | QueryOptions<T> | undefined) => string | undefined
  scopeFilter?: (schoolId: string, repositories: SchoolRepositories) => Filter<T> | Promise<Filter<T>>
}

export interface EntityBusinessGates<T> {
  preSave?: (entity: T, existing: T | undefined, repositories: SchoolRepositories) => Promise<void>
  preDelete?: (entity: T, repositories: SchoolRepositories) => Promise<void>
}
export interface EntityBusinessHooks<T> {
  postSave?: (entity: T, existing: T | undefined, repositories: SchoolRepositories, actor: SchoolScopedActorMetadata) => Promise<void>
  postDelete?: (entity: T, repositories: SchoolRepositories, actor: SchoolScopedActorMetadata) => Promise<void>
}
export interface ManagedEntityServiceConfig<T> {
  repository: BaseRepositoryInterface<T>
  tenant: EntityTenantResolver<T>
  resource: CoreEntityKey
  gates?: EntityBusinessGates<T>
  hooks?: EntityBusinessHooks<T>
  atomicExecution?: AtomicExecutionPort
}
export interface ManagedEntityServiceArgs<T> {
  actor: SchoolScopedActorMetadata
  repositories: SchoolRepositories
  config: ManagedEntityServiceConfig<T>
}

export class ManagedEntityService<T> {
  private readonly actor: SchoolScopedActorMetadata
  private readonly repositories: SchoolRepositories
  private readonly config: ManagedEntityServiceConfig<T>
  private readonly access: ReturnType<typeof createAccessPolicies>

  constructor(args: ManagedEntityServiceArgs<T>) {
    this.actor = args.actor
    this.repositories = args.repositories
    this.config = args.config
    this.access = createAccessPolicies({ actor: args.actor, repositories: args.repositories })
  }

  private async readRepository(): Promise<BaseRepositoryInterface<T>> {
    return this.config.repository.forAccess(await this.access.entity(this.config.resource).readScope())
  }

  async findById(id: string): Promise<T | undefined> {
    return (await this.readRepository()).findById(id)
  }

  async findByIds(ids: readonly string[]): Promise<T[]> {
    return (await this.readRepository()).findByIds(ids)
  }

  async findOne(options?: QueryOptions<T>): Promise<T | undefined> {
    this.ensureFilterTenant(options)
    return (await this.readRepository()).findOne(options)
  }

  async list(options?: QueryOptions<T>): Promise<T[]> {
    this.ensureFilterTenant(options)
    return (await this.readRepository()).list(options)
  }

  async count(filter?: Filter<T>): Promise<number> {
    this.ensureFilterTenant(filter)
    return (await this.readRepository()).count(filter)
  }

  async save(entity: T): Promise<void> {
    await this.executeWrite(async () => {
      const id = getEntityId(entity)
      const existing = id ? await this.tenantRepository().findById(id) : undefined
      const repository = await this.authorizeSave(entity, existing)
      await this.config.gates?.preSave?.(entity, existing, this.repositories)
      await repository.save(entity)
      await this.config.hooks?.postSave?.(entity, existing, this.repositories, this.actor)
    })
  }

  async batchSave(entities: T[]): Promise<string[]> {
    return this.executeWrite(async () => {
      const ids = entities.map(getEntityId)
      if (ids.some(id => !id) || new Set(ids).size !== ids.length)
        this.deny()
      const existing = await this.tenantRepository().findByIds(ids as string[])
      const existingById = new Map(existing.map(entity => [getEntityId(entity), entity]))
      const authorized: BaseRepositoryInterface<T>[] = []
      for (const entity of entities) {
        const before = existingById.get(getEntityId(entity))
        authorized.push(await this.authorizeSave(entity, before))
      }
      for (const [index, entity] of entities.entries()) {
        // All authorization is preflighted; business validation sees earlier writes
        // in this transaction, so conflicting proposals cannot bypass invariants.
        await this.config.gates?.preSave?.(entity, existingById.get(getEntityId(entity)), this.repositories)
        await authorized[index]!.save(entity)
        await this.config.hooks?.postSave?.(entity, existingById.get(getEntityId(entity)), this.repositories, this.actor)
      }
      return ids as string[]
    })
  }

  async delete(id: string): Promise<void> {
    await this.batchDelete([id])
  }

  async batchDelete(ids: string[]): Promise<void> {
    await this.executeWrite(async () => {
      const uniqueIds = [...new Set(ids)]
      if (!uniqueIds.length)
        return
      const scope = await this.access.entity(this.config.resource).assertDelete(uniqueIds)
      const repository = this.config.repository.forAccess(scope)
      const entities = await this.tenantRepository().findByIds(uniqueIds)
      if (entities.length !== uniqueIds.length)
        this.deny()
      for (const entity of entities) {
        await repository.assertAccess(entity)
        await this.config.gates?.preDelete?.(entity, this.repositories)
      }
      await repository.batchDelete(uniqueIds)
      for (const entity of entities) await this.config.hooks?.postDelete?.(entity, this.repositories, this.actor)
    })
  }

  private async authorizeSave(entity: T, existing: T | undefined): Promise<BaseRepositoryInterface<T>> {
    await this.ensureEntityTenant(entity)
    if (existing)
      await this.ensureEntityTenant(existing)
    const scope = await this.access.entity(this.config.resource).assertSave(entity as CoreEntityMap[CoreEntityKey], existing as CoreEntityMap[CoreEntityKey] | undefined)
    return this.config.repository.forAccess(scope)
  }

  private tenantRepository(): BaseRepositoryInterface<T> {
    if (!this.config.repository.forSchool)
      return this.deny()
    return this.config.repository.forSchool(this.actor.schoolId)
  }

  private async executeWrite<R>(operation: () => Promise<R>): Promise<R> {
    if (!this.config.atomicExecution)
      throw new Error('Entity writes require atomic execution')
    return this.config.atomicExecution.execute(operation)
  }

  private ensureFilterTenant(filter: Filter<T> | QueryOptions<T> | undefined): void {
    const schoolId = this.config.tenant.resolveFromFilter?.(filter)
    if (schoolId && schoolId !== this.actor.schoolId)
      this.deny()
  }

  private async ensureEntityTenant(entity: T): Promise<void> {
    if (await this.config.tenant.resolve(entity, this.repositories) !== this.actor.schoolId)
      this.deny()
  }

  private deny(): never { throw new AuthorizationError(AuthorizationErrorCode.Forbidden) }
}

function getEntityId(entity: unknown): string | undefined {
  return entity && typeof entity === 'object' && 'id' in entity && typeof entity.id === 'string' ? entity.id : undefined
}
