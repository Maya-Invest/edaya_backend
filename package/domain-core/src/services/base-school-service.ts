import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
import type { AtomicExecutionPort, FileStoragePort, InvitationDeliveryPort, NotificationGatewayPort, SchoolRepositories } from '../ports'
import type { ServiceArgs } from '../shared/service-args'
import type { CoreEntityServices } from './core-entity-catalog'
import { noOpInvitationDeliveryPort } from '../invitations/no-op-invitation-delivery'
import { noOpFileStorage } from '../storage/no-op-file-storage'
import { NotificationTemplateService } from '../notifications/templates/notification-template-service'
import { createCoreEntityServices } from './core-entity-catalog'

export class BaseSchoolService {
  readonly actor: ActorMetadata
  readonly repositories: SchoolRepositories
  readonly authorizationPolicy: AuthorizationPolicy
  readonly atomicExecution: AtomicExecutionPort
  readonly notificationGateway: NotificationGatewayPort
  readonly fileStorage: FileStoragePort
  readonly invitationDelivery: InvitationDeliveryPort
  readonly templateService: NotificationTemplateService
  readonly authContactResolver?: import('../ports/auth-contact-resolver').AuthContactResolverPort
  readonly inviteBaseUrl?: string
  readonly accountInvitationsEnabled: boolean
  readonly entities: CoreEntityServices

  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.repositories = args.repositories
    this.authorizationPolicy = args.authorizationPolicy
    this.atomicExecution = args.atomicExecution
    this.notificationGateway = args.notificationGateway
    this.fileStorage = args.fileStorage ?? noOpFileStorage
    this.invitationDelivery = args.invitationDelivery ?? noOpInvitationDeliveryPort
    this.templateService = args.templateService ?? new NotificationTemplateService(args.repositories)
    this.authContactResolver = args.authContactResolver
    this.inviteBaseUrl = args.inviteBaseUrl
    this.accountInvitationsEnabled = args.accountInvitationsEnabled ?? true
    this.entities = createCoreEntityServices({ ...args, templateService: this.templateService })
  }
}
