import type { AuthorizedServiceArgs } from '../capabilities/authorization'
import type { NotificationTemplateService } from '../capabilities/notifications/templates/notification-template-service'
import type { AtomicExecutionPort, AuthCacheInvalidationPort, AuthContactResolverPort, FileStoragePort, InvitationDeliveryPort, NotificationGatewayPort, SchoolRepositories } from '../ports'

export interface ServiceArgs extends AuthorizedServiceArgs {
  atomicExecution: AtomicExecutionPort
  repositories: SchoolRepositories
  notificationGateway: NotificationGatewayPort
  fileStorage: FileStoragePort
  templateService?: NotificationTemplateService
  invitationDelivery?: InvitationDeliveryPort
  authContactResolver?: AuthContactResolverPort
  authCacheInvalidation?: AuthCacheInvalidationPort
  /** Base URL for invitation accept links, e.g. https://app.edaya.com/invite */
  inviteBaseUrl?: string
  /** When false, auto-invite and manual send are skipped at runtime. Defaults to true. */
  accountInvitationsEnabled?: boolean
}
