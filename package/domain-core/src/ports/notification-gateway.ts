import type {
  AnnouncementPriority,
  MessageDeliveryChannel,
  MessageDeliveryRecipientKind,
} from '../domains'

export type NotificationKind = 'ad_hoc' | 'event' | 'job'

export interface NotificationRecipient {
  kind: MessageDeliveryRecipientKind
  id: string
}

export interface NotificationEnqueueInput {
  /** Stable key for deduplication, e.g. `report-card-published:{resultId}` */
  idempotencyKey: string
  schoolId: string
  kind: NotificationKind
  /** Links to Announcement when materialized; optional for enqueue-only paths */
  announcementId?: string
  /** Template / event identifier for logging and provider mapping */
  eventKey: string
  title: string
  body: string
  recipients: NotificationRecipient[]
  channels?: MessageDeliveryChannel[]
  priority?: AnnouncementPriority
  premium?: boolean
  deliverAfter?: Date
  expiresAt?: Date
  metadata?: Record<string, string>
}

/**
 * Outbound notification port. Implementations must be fast and non-blocking for
 * callers — enqueue records intent; delivery happens asynchronously.
 */
export interface NotificationGatewayPort {
  enqueue: (input: NotificationEnqueueInput) => Promise<void>
  cancel: (idempotencyKey: string) => Promise<void>
}
