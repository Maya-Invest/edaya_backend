import type { BaseRepositoryInterface, Filter, QueryOptions } from '../../ports/base-repository'
import type { ActorMetadata } from '../authorization/actor-metadata'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization/authorization-error'

function checkTenantBoundary(actor: ActorMetadata, optionsOrFilter: any) {
  if (!optionsOrFilter)
    return
  if ('schoolId' in optionsOrFilter) {
    const val = optionsOrFilter.schoolId
    let resolved: string | undefined
    if (typeof val === 'string') {
      resolved = val
    }
    else if (val && typeof val === 'object') {
      if (typeof val.$eq === 'string')
        resolved = val.$eq
      else if (Array.isArray(val.$in) && val.$in.length > 0 && typeof val.$in[0] === 'string')
        resolved = val.$in[0]
    }
    if (resolved && resolved !== actor.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

function checkEntityTenant(actor: ActorMetadata, entity: any) {
  if (!entity)
    return
  const entSchoolId = entity.schoolId ?? (entity.id && typeof entity.id === 'string' && (entity.constructor?.name === 'School' || ('timeZone' in entity && 'name' in entity)) ? entity.id : undefined)
  if (entSchoolId && entSchoolId !== actor.schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

export class AuthorizedReadService<T> {
  constructor(
    private readonly repository: BaseRepositoryInterface<T>,
    private readonly actor: ActorMetadata,
    private readonly checkModule: (actor: ActorMetadata) => Promise<void>,
    private readonly checkAccess: (actor: ActorMetadata, ids: string[]) => Promise<void>,
  ) {}

  async findById(id: string): Promise<T | undefined> {
    await this.checkAccess(this.actor, [id])
    const entity = await this.repository.findById(id)
    if (entity) {
      checkEntityTenant(this.actor, entity)
    }
    return entity
  }

  async findOne(options?: QueryOptions<T>): Promise<T | undefined> {
    checkTenantBoundary(this.actor, options)
    const entity = await this.repository.findOne(options)
    if (entity) {
      checkEntityTenant(this.actor, entity)
      if ((entity as any).id) {
        await this.checkAccess(this.actor, [(entity as any).id])
      }
      else {
        await this.checkModule(this.actor)
      }
    }
    else {
      await this.checkModule(this.actor)
    }
    return entity
  }

  async list(options?: QueryOptions<T>): Promise<T[]> {
    checkTenantBoundary(this.actor, options)
    await this.checkModule(this.actor)
    const entities = await this.repository.list(options)
    for (const entity of entities) {
      checkEntityTenant(this.actor, entity)
    }
    const ids = entities.map(e => (e as any).id).filter((id): id is string => typeof id === 'string')
    if (ids.length > 0) {
      await this.checkAccess(this.actor, ids)
    }
    return entities
  }

  async count(filter?: Filter<T>): Promise<number> {
    checkTenantBoundary(this.actor, filter)
    await this.checkModule(this.actor)
    return this.repository.count(filter)
  }
}
