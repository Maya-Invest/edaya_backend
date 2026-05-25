import type { MessageDelivery } from '../entities/messaging/message-delivery'
import type { BaseRepositoryInterface } from './_base-repository'

export interface MessageDeliveryRepository extends BaseRepositoryInterface<MessageDelivery> {
  listByAnnouncement: (announcementId: string) => Promise<MessageDelivery[]>
  listByRecipient: (recipientId: string) => Promise<MessageDelivery[]>
}
