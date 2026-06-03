import type { MessageDelivery } from '../../../entities/messaging/message-delivery'
import type { EntityConfigFactory } from '../../../shared'
import { action, announcementLinkedTenant, authorizeAnnouncementLinked, authorizeAnnouncementLinkedDelete, config, noopReadAccess, read, write } from '../../../shared'

export const messageDeliveryConfig: EntityConfigFactory<MessageDelivery> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.messageDeliveries,
    tenant: announcementLinkedTenant('announcementId'),
    read: read(action(policy, 'queries.read_communications'), noopReadAccess),
    write: write(action(policy, 'communications.manage'), authorizeAnnouncementLinked(policy, 'announcementId'), authorizeAnnouncementLinkedDelete(policy)),
    atomicExecution,
  })
