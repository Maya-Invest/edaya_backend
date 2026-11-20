import { MessageDeliveryRecipientKind } from '@edaya/core'
import { expect, test } from 'bun:test'
import { buildNotificationDeliveryId } from '../../src/capabilities/notifications/delivery/deliver-notification'

test('school and tuple boundaries isolate otherwise identical notification delivery identities', () => {
  const recipient = { kind: MessageDeliveryRecipientKind.Guardian, id: 'guardian' }
  const sameSchool = buildNotificationDeliveryId('school-a', 'source', 'login', recipient)
  expect(buildNotificationDeliveryId('school-a', 'source', 'login', recipient)).toBe(sameSchool)
  expect(buildNotificationDeliveryId('school-b', 'source', 'login', recipient)).not.toBe(sameSchool)
  expect(buildNotificationDeliveryId('school:source', 'next', 'login', recipient))
    .not
    .toBe(buildNotificationDeliveryId('school', 'source:next', 'login', recipient))
  expect(buildNotificationDeliveryId('school-a', 'source', 'login', { ...recipient, kind: MessageDeliveryRecipientKind.Staff }))
    .not
    .toBe(sameSchool)
})
