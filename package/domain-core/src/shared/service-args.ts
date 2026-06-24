import type { AuthorizedServiceArgs } from '../authorization'
import type { AtomicExecutionPort, AuthContactResolverPort, InvitationDeliveryPort, NotificationGatewayPort, SchoolRepositories } from '../ports'
import { noOpInvitationDeliveryPort } from '../invitations/no-op-invitation-delivery'

export interface ServiceArgs extends AuthorizedServiceArgs {
  atomicExecution: AtomicExecutionPort
  repositories: SchoolRepositories
  notificationGateway: NotificationGatewayPort
  invitationDelivery?: InvitationDeliveryPort
  authContactResolver?: AuthContactResolverPort
  /** Base URL for invitation accept links, e.g. https://app.edaya.com/invite */
  inviteBaseUrl?: string
  /** When false, auto-invite and manual send are skipped at runtime. Defaults to true. */
  accountInvitationsEnabled?: boolean
}
