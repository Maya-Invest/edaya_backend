import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
import type { AtomicExecutionPort, SchoolRepositories } from '../ports'
import type { ServiceArgs } from '../shared/service-args'
import type { CoreEntityServices } from './core-entity-catalog'
import { createCoreEntityServices } from './core-entity-catalog'

export class BaseSchoolService {
  readonly actor: ActorMetadata
  readonly repositories: SchoolRepositories
  readonly authorizationPolicy: AuthorizationPolicy
  readonly atomicExecution: AtomicExecutionPort
  readonly entities: CoreEntityServices

  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.repositories = args.repositories
    this.authorizationPolicy = args.authorizationPolicy
    this.atomicExecution = args.atomicExecution
    this.entities = createCoreEntityServices(args)
  }
}
