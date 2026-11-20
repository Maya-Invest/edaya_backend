import type { MessageDeliverySeedRecord } from './port'
import { MessageDeliveryStatus } from '@edaya/core'

function laterIso(left?: string, right?: string | Date): string | undefined {
  const rightIso = right instanceof Date ? right.toISOString() : right
  if (!left)
    return rightIso
  if (!rightIso)
    return left
  return Date.parse(left) >= Date.parse(rightIso) ? left : rightIso
}

/** Apply fixture history to the existing source/profile delivery without replacing its identity. */
export function seedDeliveryEvents(record: MessageDeliverySeedRecord, existingSentAt?: string | Date) {
  if (record.status === MessageDeliveryStatus.Pending)
    return []
  if (record.status === MessageDeliveryStatus.Read) {
    return [
      { status: MessageDeliveryStatus.Sent, occurredAt: record.sentAt },
      { status: MessageDeliveryStatus.Read, occurredAt: laterIso(record.readAt, existingSentAt) },
    ] as const
  }
  return [{ status: record.status, occurredAt: record.sentAt, failureReason: record.failureReason }] as const
}
