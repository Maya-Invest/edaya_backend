export interface NormalizedDeliveryEvent {
  deliveryId: string
  status: 'sent' | 'failed' | 'read' | 'cancelled'
  providerMessageId?: string
  channel?: string
  failureReason?: string
  occurredAt: Date
  subjectId?: string
}
