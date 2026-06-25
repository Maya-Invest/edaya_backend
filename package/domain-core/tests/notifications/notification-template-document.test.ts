import { describe, expect, test } from 'bun:test'
import {
  buildDefaultNotificationTemplateDocument,
} from '../../src/notifications/templates/defaults/manifest'
import {
  schoolNotificationTemplateDocumentSchema,
} from '../../src/notifications/templates/document-schema'
import {
  NOTIFICATION_TEMPLATE_KEYS,
} from '../../src/notifications/templates/keys'

describe('schoolNotificationTemplateDocumentSchema', () => {
  test('accepts the platform default document with all catalog keys', async () => {
    const document = await buildDefaultNotificationTemplateDocument()

    expect(() => schoolNotificationTemplateDocumentSchema.parse(document)).not.toThrow()
    expect(Object.keys(document).sort()).toEqual([...NOTIFICATION_TEMPLATE_KEYS].sort())
  })

  test('requires both channels for operational templates', () => {
    expect(() => schoolNotificationTemplateDocumentSchema.parse({
      'announcement.published': {
        email: { subject: 'Hi', body: '<p>Hi</p>' },
      },
    })).toThrow()
  })

  test('allows email-only account invitation template', async () => {
    const document = await buildDefaultNotificationTemplateDocument()

    expect(document.account_invitation.email?.body).toContain('{{inviteUrl}}')
    expect('in_app' in document.account_invitation).toBe(false)
  })
})
