export const NOTIFICATION_COPY_TYPES = ['base_message', 'rich_message', 'simple_message'] as const
export type NotificationCopyType = typeof NOTIFICATION_COPY_TYPES[number]

export const NOTIFICATION_SEND_CHANNELS = ['in_app', 'email', 'push', 'sms'] as const
export type NotificationSendChannel = typeof NOTIFICATION_SEND_CHANNELS[number]

export const NOTIFICATION_CHANNEL_CATALOG = {
  in_app: { type: 'base_message', gated: false },
  email: { type: 'rich_message', gated: true, flag: 'enable_email' },
  push: { type: 'base_message', gated: true, flag: 'enable_push' },
  sms: { type: 'simple_message', gated: true, flag: 'enable_sms' },
} as const satisfies Record<NotificationSendChannel, {
  type: NotificationCopyType
  gated: boolean
  flag?: 'enable_email' | 'enable_push' | 'enable_sms'
}>
