import type { ActorMetadata, AuthorizationPolicy } from '@edaya/authorization'
import type { AtomicExecutionPort, FileStoragePort, InvitationDeliveryPort, NotificationGatewayPort } from '@edaya/core'
import type { SchoolRepositories } from '../ports/school-repositories'
import type { CoreEntityServices } from './runtime/core-entity-catalog'
import type { ServiceArgs } from './service-args'
import { noOpInvitationDeliveryPort } from '@edaya/core'
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
  readonly authContactResolver?: import('@edaya/core').AuthContactResolverPort
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
