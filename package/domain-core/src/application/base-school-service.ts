import type { ActorMetadata, AuthorizationPolicy } from '../capabilities/authorization'
import type { AtomicExecutionPort, FileStoragePort, InvitationDeliveryPort, NotificationGatewayPort, SchoolRepositories } from '../ports'
import type { ServiceArgs } from './service-args'
import type { CoreEntityServices } from './runtime/core-entity-catalog'
import { noOpInvitationDeliveryPort } from '../adapters/no-op-invitation-delivery'
import { NotificationTemplateService } from '../capabilities/notifications/templates/notification-template-service'
import { createCoreEntityServices } from './runtime/core-entity-catalog'

export class BaseSchoolService {
  readonly actor: ActorMetadata
  readonly repositories: SchoolRepositories
  readonly authorizationPolicy: AuthorizationPolicy
  readonly atomicExecution: AtomicExecutionPort
  readonly notificationGateway: NotificationGatewayPort
  readonly fileStorage: FileStoragePort
  readonly invitationDelivery: InvitationDeliveryPort
  readonly templateService: NotificationTemplateService
  readonly authContactResolver?: import('../ports/gateways/auth-contact-resolver').AuthContactResolverPort
  readonly inviteBaseUrl?: string
  readonly accountInvitationsEnabled: boolean
  readonly entities: CoreEntityServices

  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.repositories = args.repositories
    this.authorizationPolicy = args.authorizationPolicy
    this.atomicExecution = args.atomicExecution
    this.notificationGateway = args.notificationGateway
    this.fileStorage = args.fileStorage
    this.invitationDelivery = args.invitationDelivery ?? noOpInvitationDeliveryPort
    this.templateService = args.templateService ?? new NotificationTemplateService(args.repositories)
    this.authContactResolver = args.authContactResolver
    this.inviteBaseUrl = args.inviteBaseUrl
    this.accountInvitationsEnabled = args.accountInvitationsEnabled ?? true
    this.entities = createCoreEntityServices({ ...args, templateService: this.templateService })
  }
}
