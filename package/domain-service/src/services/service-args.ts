import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { AtomicExecutionPort, AuthContactResolverPort, CommandJournalPort, DocumentRendererPort, DurableWorkPort, FileStoragePort, InvitationDeliveryPort, NotificationGatewayPort } from '@edaya/core'
import type { NotificationTemplateService } from '../capabilities/notifications/templates/notification-template-service'
import type { SchoolRepositories } from '../ports/school-repositories'

export interface ServiceArgs {
  actor: SchoolScopedActorMetadata
  atomicExecution: AtomicExecutionPort
  commandJournal?: CommandJournalPort
  documentRenderer?: DocumentRendererPort
  durableWork?: DurableWorkPort
  repositories: SchoolRepositories
  notificationGateway: NotificationGatewayPort
  fileStorage: FileStoragePort
  templateService?: NotificationTemplateService
  invitationDelivery?: InvitationDeliveryPort
  authContactResolver?: AuthContactResolverPort
  /** Base URL for invitation accept links, e.g. https://app.edaya.com/invite */
  inviteBaseUrl?: string
  /** When false, auto-invite and manual send are skipped at runtime. Defaults to true. */
  accountInvitationsEnabled?: boolean
  /** JPEG portrait admission cap. Defaults to 1 MiB. */
  profilePhotoMaxBytes?: number
}
