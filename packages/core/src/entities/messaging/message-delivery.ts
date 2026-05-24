import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '$lib/core/utils/validation'

export enum MessageDeliveryChannel {
  App = 'app',
  Email = 'email',
  Sms = 'sms',
  WhatsApp = 'whatsapp',
  Other = 'other',
}

export enum MessageDeliveryRecipientKind {
  Staff = 'staff',
  Guardian = 'guardian',
  Student = 'student',
}

export enum MessageDeliveryStatus {
  Pending = 'pending',
  Sent = 'sent',
  Failed = 'failed',
  Read = 'read',
  Cancelled = 'cancelled',
}

export interface MessageDeliveryArgs {
  id: string
  announcementId: string
  recipientKind: MessageDeliveryRecipientKind
  recipientId: string
  channel: MessageDeliveryChannel
  status?: MessageDeliveryStatus
  providerMessageId?: string | null
  failureReason?: string | null
  sentAt?: Date | null
  readAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Tracks delivery state for one announcement/message to one concrete recipient.
 */
export class MessageDelivery {
  readonly id: string
  readonly announcementId: string
  readonly recipientKind: MessageDeliveryRecipientKind
  readonly recipientId: string
  readonly channel: MessageDeliveryChannel
  readonly status: MessageDeliveryStatus
  readonly providerMessageId?: string
  readonly failureReason?: string
  readonly sentAt?: Date
  readonly readAt?: Date
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    announcementId,
    recipientKind,
    recipientId,
    channel,
    status = MessageDeliveryStatus.Pending,
    providerMessageId,
    failureReason,
    sentAt,
    readAt,
    createdAt,
    updatedAt,
  }: MessageDeliveryArgs) {
    this.id = requireNonBlank(id, 'id')
    this.announcementId = requireNonBlank(announcementId, 'announcementId')
    this.recipientKind = recipientKind
    this.recipientId = requireNonBlank(recipientId, 'recipientId')
    this.channel = channel
    this.status = status
    this.providerMessageId = requireOptionalNonBlank(providerMessageId, 'providerMessageId')
    this.failureReason = requireOptionalNonBlank(failureReason, 'failureReason')
    this.sentAt = sentAt ? requireValidDate(sentAt, 'sentAt') : undefined
    this.readAt = readAt ? requireValidDate(readAt, 'readAt') : undefined

    const now = new Date()
    this.createdAt = createdAt ?? now
    this.updatedAt = updatedAt ?? now

    if ((this.status === MessageDeliveryStatus.Sent || this.status === MessageDeliveryStatus.Read) && !this.sentAt) {
      throw new Error('sentAt is required for sent or read message deliveries')
    }
    if (this.status === MessageDeliveryStatus.Read && !this.readAt) {
      throw new Error('readAt is required for read message deliveries')
    }
    if (this.status === MessageDeliveryStatus.Failed && !this.failureReason) {
      throw new Error('failureReason is required for failed message deliveries')
    }
    if (this.readAt && this.sentAt && this.readAt.getTime() < this.sentAt.getTime()) {
      throw new Error('readAt must not be before sentAt')
    }
  }
}
