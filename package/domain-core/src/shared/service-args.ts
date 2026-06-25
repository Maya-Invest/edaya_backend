import type { AuthorizedServiceArgs } from '../authorization'
import type { NotificationTemplateService } from '../notifications/templates/notification-template-service'
import type { AtomicExecutionPort, AuthContactResolverPort, InvitationDeliveryPort, NotificationGatewayPort, SchoolRepositories } from '../ports'

export interface ServiceArgs extends AuthorizedServiceArgs {
  atomicExecution: AtomicExecutionPort
  repositories: SchoolRepositories
  notificationGateway: NotificationGatewayPort
  templateService?: NotificationTemplateService
  invitationDelivery?: InvitationDeliveryPort
  authContactResolver?: AuthContactResolverPort
  /** Base URL for invitation accept links, e.g. https://app.edaya.com/invite */
  inviteBaseUrl?: string
  /** When false, auto-invite and manual send are skipped at runtime. Defaults to true. */
  accountInvitationsEnabled?: boolean
}
