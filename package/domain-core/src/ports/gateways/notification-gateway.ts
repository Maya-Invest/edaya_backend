import type {
  AnnouncementPriority,
  MessageDeliveryRecipientKind,
} from '../../domain'

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
  /** Resolved delivery email from current profile and identity contacts */
  email?: string
  /** Resolved delivery phone from current profile and identity contacts */
  phone?: string
  /** Explicit notification override; defaults to auth email when unset */
  notificationEmail?: string
  /** Explicit notification override; defaults to auth phone when unset */
  notificationPhone?: string
  /** School-record contact used only when notification override and auth contact are absent */
  fallbackEmail?: string
  fallbackPhone?: string
  locale?: string
  preferences: {
    receivesAttendanceAlerts?: boolean
    receivesAcademicReports?: boolean
    allowsNotifications?: boolean
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
  /** Rendered email subject — defaults to `title` when omitted at the provider */
  emailSubject?: string
  /** Rendered email HTML body — defaults to `body` when omitted at the provider */
  emailBody?: string
  /** Rendered SMS body from simple_message */
  smsBody?: string
  /** School template gates — adaptor fans out after AND with recipient prefs */
  enableEmail?: boolean
  enablePush?: boolean
  enableSms?: boolean
  recipients: NotificationRecipient[]
  priority?: AnnouncementPriority
  deliverAfter?: Date
  expiresAt?: Date
  metadata?: Record<string, string>
}

/** A durable school send must resolve its exact recipient from current business facts. */
export interface NotificationDispatchRequest {
  deliveryId: string
  schoolId: string
  subjectId: string
  eventKey: string
  metadata: Readonly<Record<string, string>>
}

export type ResolveNotificationDispatchRecipient = (
  request: NotificationDispatchRequest,
) => Promise<NotificationRecipientProfile | undefined>

export interface NotificationDeliveryStatusLookup {
  status: 'sent' | 'failed' | 'read' | 'cancelled'
  providerMessageId?: string
  failureReason?: string
  occurredAt?: Date
}

export interface NotificationDeliveryStatusQuery {
  schoolId: string
  deliveryId: string
  subjectId: string
}

export type PushDeviceProvider = 'fcm' | 'apns'

export interface RegisterPushDeviceInput {
  subjectId: string
  schoolId: string
  token: string
  provider: PushDeviceProvider
}

export interface UnregisterPushDeviceInput {
  schoolId: string
  subjectId: string
  provider: PushDeviceProvider
}

/**
 * Outbound notification port. Implementations must be fast and non-blocking for
 * callers — enqueue records intent; delivery happens asynchronously.
 */
export interface NotificationGatewayPort {
  enqueue: (input: NotificationEnqueueInput) => Promise<void>
  cancel: (idempotencyKey: string, schoolId: string) => Promise<void>
  /** Poll remaining pending deliveries — used by reconcilePendingDeliveries cron */
  lookupDeliveryStatuses?: (
    deliveries: ReadonlyArray<NotificationDeliveryStatusQuery>,
  ) => Promise<ReadonlyMap<string, NotificationDeliveryStatusLookup>>
  /** Attach a mobile push token to the authenticated login. */
  registerPushDevice?: (input: RegisterPushDeviceInput) => Promise<void>
  /** Remove push credentials for the authenticated login. */
  unregisterPushDevice?: (input: UnregisterPushDeviceInput) => Promise<void>
}
