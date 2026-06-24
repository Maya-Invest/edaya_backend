import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
import type { AtomicExecutionPort, NotificationGatewayPort, SchoolRepositories } from '../ports'
import type { ServiceArgs } from '../shared/service-args'
import type { CoreEntityServices } from './core-entity-catalog'
import { createCoreEntityServices } from './core-entity-catalog'

export class BaseSchoolService {
  readonly actor: ActorMetadata
  readonly repositories: SchoolRepositories
  readonly authorizationPolicy: AuthorizationPolicy
  readonly atomicExecution: AtomicExecutionPort
  readonly notificationGateway: NotificationGatewayPort
  readonly authContactResolver?: import('../ports/auth-contact-resolver').AuthContactResolverPort
  readonly entities: CoreEntityServices

  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.repositories = args.repositories
    this.authorizationPolicy = args.authorizationPolicy
    this.atomicExecution = args.atomicExecution
    this.notificationGateway = args.notificationGateway
    this.authContactResolver = args.authContactResolver
    this.entities = createCoreEntityServices(args)
  }
}
