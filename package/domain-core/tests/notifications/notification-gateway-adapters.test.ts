import { describe, expect, test } from 'bun:test'
import { MessageDeliveryRecipientKind } from '../../src/domain'
import {
  noOpNotificationGateway,
  RecordingNotificationGateway,
} from '../../src/adapters'

describe('notification gateway adapters', () => {
  test('noOpNotificationGateway resolves enqueue, cancel, and subscriber sync', async () => {
    await expect(noOpNotificationGateway.enqueue({
      idempotencyKey: 'test:1',
      schoolId: 'school-1',
      kind: 'event',
      eventKey: 'test.event',
      title: 'Title',
      body: 'Body',
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: 'g1' }],
    })).resolves.toBeUndefined()

    await expect(noOpNotificationGateway.cancel('test:1')).resolves.toBeUndefined()
    await expect(noOpNotificationGateway.upsertRecipient({
      schoolId: 'school-1',
      recipient: { kind: MessageDeliveryRecipientKind.Guardian, id: 'g1', subjectId: 'auth-g1' },
      preferences: {},
    })).resolves.toBeUndefined()
    await expect(noOpNotificationGateway.removeRecipient(
      'school-1',
      { kind: MessageDeliveryRecipientKind.Guardian, id: 'g1', subjectId: 'auth-g1' },
    )).resolves.toBeUndefined()
  })

  test('RecordingNotificationGateway records enqueue and cancel', async () => {
    const gateway = new RecordingNotificationGateway()
    const input = {
      idempotencyKey: 'report_card.published:rc1',
      schoolId: 'school-1',
      kind: 'event' as const,
      eventKey: 'report_card.published',
      title: 'Report card',
      body: 'Available now',
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: 'g1' }],
    }

    await gateway.enqueue(input)
    await gateway.cancel(input.idempotencyKey)

    expect(gateway.enqueued).toEqual([input])
    expect(gateway.cancelled).toEqual([input.idempotencyKey])
  })

  test('RecordingNotificationGateway deduplicates enqueue by idempotencyKey', async () => {
    const gateway = new RecordingNotificationGateway()
    const input = {
      idempotencyKey: 'attendance.recorded:s1:session1',
      schoolId: 'school-1',
      kind: 'event' as const,
      eventKey: 'attendance.recorded',
      title: 'Attendance',
      body: 'Absent',
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: 'g1' }],
    }

    await gateway.enqueue(input)
    await gateway.enqueue({ ...input, title: 'Duplicate' })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]?.title).toBe('Attendance')
  })

  test('RecordingNotificationGateway allows re-enqueue after cancel', async () => {
    const gateway = new RecordingNotificationGateway()
    const input = {
      idempotencyKey: 'job:assessment:due:a1',
      schoolId: 'school-1',
      kind: 'job' as const,
      eventKey: 'assessment.due_soon',
      title: 'Due soon',
      body: 'Assessment tomorrow',
      recipients: [{ kind: MessageDeliveryRecipientKind.Student, id: 's1' }],
    }

    await gateway.enqueue(input)
    await gateway.cancel(input.idempotencyKey)
    await gateway.enqueue({ ...input, title: 'Rescheduled' })

    expect(gateway.enqueued).toHaveLength(2)
    expect(gateway.enqueued[1]?.title).toBe('Rescheduled')
  })
})
