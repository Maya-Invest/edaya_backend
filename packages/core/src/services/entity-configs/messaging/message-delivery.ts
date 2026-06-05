import type { MessageDelivery } from '../../../entities/messaging/message-delivery'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { announcementLinkedTenant, authorizeAnnouncementLinked, authorizeAnnouncementLinkedDelete, config, noopReadAccess, permissionAction, read, write } from '../../../shared'

export const messageDeliveryConfig: EntityConfigFactory<MessageDelivery> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.messageDeliveries,
    tenant: announcementLinkedTenant('announcementId'),
    read: read(permissionAction(policy, Permission.QUERY_COMMUNICATIONS_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.COMMUNICATION_CREATE), authorizeAnnouncementLinked(policy, 'announcementId'), authorizeAnnouncementLinkedDelete(policy)),
    atomicExecution,
  })
