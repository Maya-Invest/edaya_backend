import { describe, expect, test } from 'bun:test'
import {
  buildDefaultNotificationTemplateDocument,
} from '../../src/capabilities/notifications/templates/defaults/manifest'
import {
  schoolNotificationTemplateDocumentSchema,
} from '../../src/capabilities/notifications/templates/document-schema'
import {
  NOTIFICATION_TEMPLATE_FIELDS,
  NOTIFICATION_TEMPLATE_KEYS,
} from '../../src/capabilities/notifications/templates/keys'

describe('schoolNotificationTemplateDocumentSchema', () => {
  test('accepts the platform default document with all catalog keys', async () => {
    const document = await buildDefaultNotificationTemplateDocument()

    expect(() => schoolNotificationTemplateDocumentSchema.parse(document)).not.toThrow()
    expect(Object.keys(document).sort()).toEqual(
      ['invitationSmsEnabled', ...Object.values(NOTIFICATION_TEMPLATE_FIELDS)].sort(),
    )
    expect(NOTIFICATION_TEMPLATE_KEYS).toHaveLength(Object.values(NOTIFICATION_TEMPLATE_FIELDS).length)
  })

  test('requires copy types for operational templates', () => {
    expect(() => schoolNotificationTemplateDocumentSchema.parse({
      announcementPublished: {
        rich_message: { subject: 'Hi', body: '<p>Hi</p>' },
      },
    })).toThrow()
  })

  test('allows invitation templates without in-app or push copy', async () => {
    const document = await buildDefaultNotificationTemplateDocument()

    expect(document.accountInvitation.rich_message.body).toContain('{{inviteUrl}}')
    expect('base_message' in document.accountInvitation).toBe(false)
  })
})
