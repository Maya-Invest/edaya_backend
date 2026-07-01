import { describe, expect, test } from 'bun:test'
import { MessageDeliveryRecipientKind } from '../../src/domain'
import { enrichRecipientProfile, resolveNotificationEmail, resolveNotificationPhone } from '../../src/capabilities/notifications/delivery/resolve-notification-contact'

describe('resolveNotificationContact', () => {
  test('prefers explicit notification email over auth and fallback', () => {
    expect(resolveNotificationEmail(
      'notify@example.com',
      { email: 'auth@example.com' },
      'school@example.com',
    )).toBe('notify@example.com')
  })

  test('defaults notification email to auth email', () => {
    expect(resolveNotificationEmail(
      undefined,
      { email: 'auth@example.com' },
      'school@example.com',
    )).toBe('auth@example.com')
  })

  test('falls back to school contact when auth email is absent', () => {
    expect(resolveNotificationEmail(
      undefined,
      undefined,
      'school@example.com',
    )).toBe('school@example.com')
  })

  test('prefers explicit notification phone over auth and fallback', () => {
    expect(resolveNotificationPhone(
      '+33123456789',
      { phone: '+33999999999' },
      '+33000000000',
    )).toBe('+33123456789')
  })

  test('enrichRecipientProfile resolves delivery contact for provider sync', () => {
    const enriched = enrichRecipientProfile({
      schoolId: 'school-1',
      recipient: { kind: MessageDeliveryRecipientKind.Guardian, id: 'g1', subjectId: 'auth-g1' },
      notificationEmail: undefined,
      fallbackEmail: 'school@example.com',
      preferences: {
        allowsNotifications: true,
        channels: { email: true },
      },
    }, { email: 'auth@example.com' })

    expect(enriched.email).toBe('auth@example.com')
    expect(enriched.phone).toBeUndefined()
  })
})
