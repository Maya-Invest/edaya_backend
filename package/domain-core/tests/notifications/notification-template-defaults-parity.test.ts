import { describe, expect, test } from 'bun:test'
import { loadAccountInvitationDefaultFiles } from '../../src/notifications/templates/defaults/load-default-files'
import { buildDefaultNotificationTemplateDocument } from '../../src/notifications/templates/defaults/manifest'
import { NOTIFICATION_TEMPLATE_KEYS } from '../../src/notifications/templates/keys'

describe('notification template defaults parity', () => {
  test('account_invitation slice matches on-disk default files', async () => {
    const [document, files] = await Promise.all([
      buildDefaultNotificationTemplateDocument(),
      loadAccountInvitationDefaultFiles(),
    ])

    expect(document.account_invitation.email?.subject).toBe(files.subject)
    expect(document.account_invitation.email?.body).toBe(files.body)
  })

  test('default document includes every catalog key', async () => {
    const document = await buildDefaultNotificationTemplateDocument()
    expect(Object.keys(document).sort()).toEqual([...NOTIFICATION_TEMPLATE_KEYS].sort())
  })
})
