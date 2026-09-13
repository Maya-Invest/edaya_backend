import type { MessageDeliverySeedRecord } from './port'
import { MessageDeliveryStatus } from '@edaya/core'

/** Apply fixture history to the existing source/profile delivery without replacing its identity. */
export function seedDeliveryEvents(record: MessageDeliverySeedRecord) {
  if (record.status === MessageDeliveryStatus.Pending)
    return []
  if (record.status === MessageDeliveryStatus.Read) {
    return [
      { status: MessageDeliveryStatus.Sent, occurredAt: record.sentAt },
      { status: MessageDeliveryStatus.Read, occurredAt: record.readAt },
    ] as const
  }
  return [{ status: record.status, occurredAt: record.sentAt, failureReason: record.failureReason }] as const
}
