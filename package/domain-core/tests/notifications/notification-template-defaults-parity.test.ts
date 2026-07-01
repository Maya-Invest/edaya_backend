import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { loadAccountInvitationDefaultFiles } from '../../src/capabilities/notifications/templates/defaults/load-default-files'
import { buildDefaultNotificationTemplateDocument } from '../../src/capabilities/notifications/templates/defaults/manifest'
import { NOTIFICATION_TEMPLATE_KEYS } from '../../src/capabilities/notifications/templates/keys'

const defaultsDir = resolve(import.meta.dirname, '../../src/capabilities/notifications/templates/defaults')

async function readOnDiskDefault(relativePath: string): Promise<string> {
  return (await readFile(resolve(defaultsDir, relativePath), 'utf8')).trim()
}

describe('notification template defaults parity', () => {
  test('account_invitation slice matches on-disk default files', async () => {
    const [document, files, subjectOnDisk, bodyOnDisk] = await Promise.all([
      buildDefaultNotificationTemplateDocument(),
      loadAccountInvitationDefaultFiles(),
      readOnDiskDefault('subjects/account-invitation.txt'),
      readOnDiskDefault('emails/account-invitation.txt'),
    ])

    expect(files.subject).toBe(subjectOnDisk)
    expect(files.body).toBe(bodyOnDisk)
    expect(document.account_invitation.email?.subject).toBe(files.subject)
    expect(document.account_invitation.email?.body).toBe(files.body)
  })

  test('default document includes every catalog key', async () => {
    const document = await buildDefaultNotificationTemplateDocument()
    expect(Object.keys(document).sort()).toEqual([...NOTIFICATION_TEMPLATE_KEYS].sort())
  })
})
