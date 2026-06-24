import type {
  AnnouncementPriority,
  MessageDeliveryChannel,
  MessageDeliveryRecipientKind,
} from '../domains'

export type NotificationKind = 'ad_hoc' | 'event' | 'job'

export interface NotificationRecipient {
  kind: MessageDeliveryRecipientKind
  id: string
  /** Better Auth user id — required for provider dispatch when known */
  subjectId?: string
}

export interface NotificationRecipientProfile {
  schoolId: string
  recipient: NotificationRecipient
  displayName?: string
  email?: string
  phone?: string
  locale?: string
  preferences: {
    receivesAttendanceAlerts?: boolean
    receivesAcademicReports?: boolean
    allowsNotifications?: boolean
    premiumNotificationsEnabled?: boolean
    channels?: Partial<Record<'email' | 'sms' | 'push' | 'in_app', boolean>>
  }
}

export interface NotificationEnqueueInput {
  /** Stable key for deduplication — per delivery use MessageDelivery.id */
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
  priority?: AnnouncementPriority
  premium?: boolean
  deliverAfter?: Date
  expiresAt?: Date
  metadata?: Record<string, string>
}

export interface NotificationDeliveryStatusLookup {
  status: 'sent' | 'failed' | 'read' | 'cancelled'
  providerMessageId?: string
  failureReason?: string
  occurredAt?: Date
}

export interface NotificationDeliveryStatusQuery {
  deliveryId: string
  subjectId: string
}

/**
 * Outbound notification port. Implementations must be fast and non-blocking for
 * callers — enqueue records intent; delivery happens asynchronously.
 */
export interface NotificationGatewayPort {
  enqueue: (input: NotificationEnqueueInput) => Promise<void>
  cancel: (idempotencyKey: string) => Promise<void>
  upsertRecipient: (profile: NotificationRecipientProfile) => Promise<void>
  removeRecipient: (schoolId: string, recipient: NotificationRecipient) => Promise<void>
  /** Poll provider message status — used by reconcilePendingDeliveries cron when webhooks are unavailable */
  lookupDeliveryStatuses?: (
    deliveries: ReadonlyArray<NotificationDeliveryStatusQuery>,
  ) => Promise<ReadonlyMap<string, NotificationDeliveryStatusLookup>>
}

/** Channel preference mapping for subscriber sync — not used for routing in domain */
export type NotificationChannelPreference = MessageDeliveryChannel
