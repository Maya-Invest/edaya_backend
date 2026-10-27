import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { migrationDirectory } from './support/authorization-database'

test('copy-type migration splits template blobs and adds notify phone columns', async () => {
  const db = new PGlite()
  try {
    for (const file of readdirSync(migrationDirectory).filter(file => /^00(?:0\d|1\d)_.*\.sql$/.test(file)).sort())
      await db.exec(readFileSync(join(migrationDirectory, file), 'utf8'))

    await db.exec(`INSERT INTO schools (id, name, time_zone, created_at) VALUES ('school', 'Legacy', 'UTC', now())`)
    await db.exec(`INSERT INTO school_notification_templates (school_id, templates, created_at, updated_at)
      VALUES ('school', '{"announcement.published":{"email":{"subject":"Custom","body":"<p>Hi</p>"},"in_app":{"subject":"In-app","body":"Body"}},"account_invitation":{"email":{"subject":"Invite","body":"<p>Join</p>"}}}'::jsonb, now(), now())`)

    await db.exec(readFileSync(join(migrationDirectory, '0020_notification_copy_types.sql'), 'utf8'))

    const row = (await db.query(`SELECT invitation_sms_enabled, announcement_published, account_invitation
      FROM school_notification_templates WHERE school_id = 'school'`)).rows[0] as {
      invitation_sms_enabled: boolean
      announcement_published: {
        enable_email: boolean
        enable_push: boolean
        enable_sms: boolean
        base_message: { title: string, body: string }
        rich_message: { subject: string, body: string }
        simple_message: { body: string }
      }
      account_invitation: {
        rich_message: { subject: string, body: string }
        simple_message: { body: string }
      }
    }

    expect(row.invitation_sms_enabled).toBe(false)
    expect(row.announcement_published.base_message).toEqual({ title: 'In-app', body: 'Body' })
    expect(row.announcement_published.rich_message).toEqual({ subject: 'Custom', body: '<p>Hi</p>' })
    expect(row.announcement_published.enable_email).toBe(true)
    expect(row.announcement_published.enable_push).toBe(true)
    expect(row.announcement_published.enable_sms).toBe(false)
    expect(row.announcement_published.simple_message.body).toContain('{{announcementTitle}}')
    expect(row.account_invitation.rich_message).toEqual({ subject: 'Invite', body: '<p>Join</p>' })
    expect(row.account_invitation.simple_message.body).toContain('{{inviteUrl}}')
    expect((await db.query(`SELECT column_name FROM information_schema.columns
      WHERE table_name = 'school_notification_templates' AND column_name = 'templates'`)).rows).toEqual([])

    expect((await db.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'notify' AND table_name = 'recipients' AND column_name IN ('phone', 'channel_sms')
      ORDER BY column_name`)).rows).toEqual([{ column_name: 'channel_sms' }, { column_name: 'phone' }])
    expect((await db.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'notify' AND table_name = 'jobs' AND column_name = 'sms_body'`)).rows).toEqual([{ column_name: 'sms_body' }])
  }
  finally {
    await db.close()
  }
}, 30000)
