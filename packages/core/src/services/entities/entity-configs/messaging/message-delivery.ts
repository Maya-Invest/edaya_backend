import type { MessageDelivery } from '../../../../entities/messaging/message-delivery'
import type { EntityConfigFactory } from '../../../shared/common'
import { action, announcementLinkedTenant, authorizeAnnouncementLinked, authorizeAnnouncementLinkedDelete, config, noopReadAccess, read, write } from '../../../shared/common'

export const messageDeliveryConfig: EntityConfigFactory<MessageDelivery> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.messageDeliveries,
    tenant: announcementLinkedTenant('announcementId'),
    read: read(action(policy, 'queries.read_communications'), noopReadAccess),
    write: write(action(policy, 'communications.manage'), authorizeAnnouncementLinked(policy, 'announcementId'), authorizeAnnouncementLinkedDelete(policy)),
    atomicExecution,
  })
