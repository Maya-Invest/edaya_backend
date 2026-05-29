import type { BaseRepositoryInterface, Filter, QueryOptions } from '../ports/base-repository'
import type { ActorMetadata } from './authorization/actor-metadata'
import type { AuthorizationAction, AuthorizationPolicy, AuthorizationResourceContext } from './authorization/authorization-policy'

export class AuthorizedReadService<T> {
  constructor(
    private readonly repository: BaseRepositoryInterface<T>,
    private readonly action: AuthorizationAction,
    private readonly actor: ActorMetadata,
    private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async findById(id: string, context: AuthorizationResourceContext): Promise<T | undefined> {
    await this.authorizationPolicy.requirePermission(this.actor, { action: this.action, resource: context })
    return this.repository.findById(id)
  }

  async findOne(context: AuthorizationResourceContext, options?: QueryOptions<T>): Promise<T | undefined> {
    await this.authorizationPolicy.requirePermission(this.actor, { action: this.action, resource: context })
    return this.repository.findOne(options)
  }

  async list(context: AuthorizationResourceContext, options?: QueryOptions<T>): Promise<T[]> {
    await this.authorizationPolicy.requirePermission(this.actor, { action: this.action, resource: context })
    return this.repository.list(options)
  }

  async count(context: AuthorizationResourceContext, filter?: Filter<T>): Promise<number> {
    await this.authorizationPolicy.requirePermission(this.actor, { action: this.action, resource: context })
    return this.repository.count(filter)
  }
}
