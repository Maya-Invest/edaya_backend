import type { AccessPolicies, SchoolScopedActorMetadata } from '@edaya/authorization'
import type { AtomicExecutionPort, FileStoragePort, InvitationDeliveryPort, NotificationGatewayPort } from '@edaya/core'
import type { SchoolRepositories } from '../ports/school-repositories'
import type { CoreEntityServices } from './runtime/core-entity-catalog'
import type { ServiceArgs } from './service-args'
import { createAccessPolicies } from '@edaya/authorization'
import { noOpInvitationDeliveryPort } from '@edaya/core'
import { NotificationTemplateService } from '../capabilities/notifications/templates/notification-template-service'
import { CommandExecution } from './commands/command-execution'
import { createCoreEntityServices } from './runtime/core-entity-catalog'

export class BaseSchoolService {
  readonly actor: SchoolScopedActorMetadata
  readonly repositories: SchoolRepositories
  readonly access: AccessPolicies
  readonly atomicExecution: AtomicExecutionPort
  readonly notificationGateway: NotificationGatewayPort
  readonly fileStorage: FileStoragePort
  readonly invitationDelivery: InvitationDeliveryPort
  readonly templateService: NotificationTemplateService
  readonly authContactResolver?: import('@edaya/core').AuthContactResolverPort
  readonly inviteBaseUrl?: string
  readonly accountInvitationsEnabled: boolean
  readonly entities: CoreEntityServices
  private readonly journal: ServiceArgs['commandJournal']

  get commandExecution(): CommandExecution {
    if (!this.journal)
      throw new Error('Reliable commands require a transactional command journal')
    return new CommandExecution(this.atomicExecution, this.journal)
  }

  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.repositories = args.repositories
    this.access = createAccessPolicies({ actor: args.actor, repositories: args.repositories })
    this.atomicExecution = args.atomicExecution
    this.journal = args.commandJournal
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
