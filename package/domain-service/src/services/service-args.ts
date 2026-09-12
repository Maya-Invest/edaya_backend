import type { SchoolScopedActorMetadata } from '@edaya/authorization';
import type { AtomicExecutionPort, AuthContactResolverPort, FileStoragePort, InvitationDeliveryPort, NotificationGatewayPort } from '@edaya/core';
import type { NotificationTemplateService } from '../capabilities/notifications/templates/notification-template-service';
import type { SchoolRepositories } from '../ports/school-repositories';

export interface ServiceArgs {
  actor: SchoolScopedActorMetadata
  atomicExecution: AtomicExecutionPort
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
}
