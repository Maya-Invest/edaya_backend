import { describe, expect, test } from 'bun:test'
import { buildDeliverySummary, MessageDelivery, MessageDeliveryChannel, MessageDeliveryRecipientKind, MessageDeliveryStatus } from '../../../../src/entities/messaging/message-delivery'

describe('MessageDelivery entity', () => {
  const baseArgs = {
    id: 'md1',
    announcementId: 'ann1',
    recipientKind: MessageDeliveryRecipientKind.Guardian,
    recipientId: 'rec1',
    channel: MessageDeliveryChannel.Email,
  }

  test('instantiates successfully with valid inputs', () => {
    const delivery = new MessageDelivery(baseArgs)
    expect(delivery.id).toBe('md1')
    expect(delivery.announcementId).toBe('ann1')
    expect(delivery.recipientKind).toBe(MessageDeliveryRecipientKind.Guardian)
    expect(delivery.channel).toBe(MessageDeliveryChannel.Email)
  })

  test('throws error if sent status lacks sentAt', () => {
    expect(() => {
      new MessageDelivery({
        ...baseArgs,
        status: MessageDeliveryStatus.Sent,
      })
    }).toThrow('sentAt is required for sent or read message deliveries')
  })

  test('throws error if read status lacks readAt', () => {
    expect(() => {
      new MessageDelivery({
        ...baseArgs,
        status: MessageDeliveryStatus.Read,
        sentAt: new Date(),
      })
    }).toThrow('readAt is required for read message deliveries')
  })

  test('throws error if failed status lacks failureReason', () => {
    expect(() => {
      new MessageDelivery({
        ...baseArgs,
        status: MessageDeliveryStatus.Failed,
      })
    }).toThrow('failureReason is required for failed message deliveries')
  })

  test('throws error if readAt is before sentAt', () => {
    expect(() => {
      new MessageDelivery({
        ...baseArgs,
        status: MessageDeliveryStatus.Read,
        sentAt: new Date('2026-09-02'),
        readAt: new Date('2026-09-01'),
      })
    }).toThrow('readAt must not be before sentAt')
  })
})

describe('buildDeliverySummary', () => {
  const baseDelivery = {
    id: 'md1',
    announcementId: 'ann1',
    recipientKind: MessageDeliveryRecipientKind.Guardian,
    recipientId: 'rec1',
    channel: MessageDeliveryChannel.Email,
  }

  test('correctly summarizes an array of deliveries', () => {
    const d1 = new MessageDelivery({ ...baseDelivery, id: 'd1', status: MessageDeliveryStatus.Pending })
    const d2 = new MessageDelivery({ ...baseDelivery, id: 'd2', status: MessageDeliveryStatus.Sent, sentAt: new Date() })
    const d3 = new MessageDelivery({ ...baseDelivery, id: 'd3', status: MessageDeliveryStatus.Failed, failureReason: 'Bounce' })
    const d4 = new MessageDelivery({ ...baseDelivery, id: 'd4', status: MessageDeliveryStatus.Read, sentAt: new Date(), readAt: new Date() })
    const d5 = new MessageDelivery({ ...baseDelivery, id: 'd5', status: MessageDeliveryStatus.Cancelled })

    const summary = buildDeliverySummary([d1, d2, d3, d4, d5, d1])

    expect(summary.total).toBe(6)
    expect(summary.pending).toBe(2)
    expect(summary.sent).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.read).toBe(1)
    expect(summary.cancelled).toBe(1)
  })

  test('returns all zeros for empty array', () => {
    const summary = buildDeliverySummary([])
    expect(summary.total).toBe(0)
    expect(summary.pending).toBe(0)
    expect(summary.sent).toBe(0)
    expect(summary.failed).toBe(0)
    expect(summary.read).toBe(0)
    expect(summary.cancelled).toBe(0)
  })
})
