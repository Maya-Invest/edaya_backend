export interface NormalizedDeliveryEvent {
  deliveryId: string
  status: 'sent' | 'failed' | 'read' | 'cancelled'
  providerMessageId?: string
  channel?: string
  failureReason?: string
  occurredAt: Date
  subjectId?: string
}

/**
 * Inbound delivery lifecycle webhooks from the notification provider.
 * Implementations verify provider signatures and normalize payloads to core events.
 */
export interface NotificationDeliveryWebhookAdapter {
  verifyRequest: (request: Request, rawBody: string) => Promise<boolean>
  parseEvents: (rawBody: string) => Promise<NormalizedDeliveryEvent[]>
}
