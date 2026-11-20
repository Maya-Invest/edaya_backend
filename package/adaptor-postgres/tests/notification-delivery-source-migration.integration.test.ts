import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'bun:test'
import { installSchemaBeforeTypedGrants, migrationDirectory } from './support/authorization-database'

const migration = readFileSync(resolve(migrationDirectory, '0011_notification_delivery_sources.sql'), 'utf8')

async function withDatabase(run: (db: PGlite) => Promise<void>) {
  const db = new PGlite()
  try {
    await installSchemaBeforeTypedGrants(db)
    await run(db)
  }
  finally { await db.close() }
}

async function insert(db: PGlite, id: string, options: { announcementId?: string, eventKey?: string, subjectId?: string, kind?: string | null, recipientId?: string } = {}) {
  await db.query(`INSERT INTO message_deliveries
    (id, school_id, announcement_id, event_key, subject_id, recipient_kind, recipient_id, title, body, status, provider_message_id, sent_at, created_at, updated_at)
    VALUES ($1, 'school', $2, $3, $4, $5, $6, 'Title', 'Body', 'sent', 'provider-original', '2026-01-01', '2026-01-01', '2026-01-01')`, [id, options.announcementId ?? null, options.eventKey ?? null, options.subjectId ?? 'login:one', options.kind === undefined ? 'guardian' : options.kind, options.recipientId ?? 'guardian'])
}

describe('offline notification source migration', () => {
  test('preserves provider IDs, content and history while extracting only the known login suffix', async () => {
    await withDatabase(async (db) => {
      await insert(db, 'delivery:result.recorded:result:one:login:one', { eventKey: 'result.recorded' })
      await insert(db, 'delivery:announcement:one:login:one', { announcementId: 'announcement:one' })
      await insert(db, 'manual-event', { eventKey: 'manual.event' })
      const before = (await db.query<Record<string, unknown>>('SELECT * FROM message_deliveries ORDER BY id')).rows
      // Provider correlation lives outside the school schema and must remain untouched.
      await db.exec('CREATE SCHEMA notify; CREATE TABLE notify.jobs (idempotency_key text PRIMARY KEY); INSERT INTO notify.jobs VALUES (\'delivery:result.recorded:result:one:login:one\')')
      await db.transaction(async (tx) => {
        await tx.exec(migration)
      })
      const after = (await db.query<Record<string, unknown> & { source_key: string | null }>('SELECT * FROM message_deliveries ORDER BY id')).rows
      expect(after.map(({ source_key: _source, ...row }) => row)).toEqual(before)
      expect(after.map(row => row.source_key)).toEqual(['announcement:one', 'result.recorded:result:one', null])
      expect((await db.query('SELECT * FROM notify.jobs')).rows).toEqual([{ idempotency_key: 'delivery:result.recorded:result:one:login:one' }])
    })
  })

  test.each([
    ['missing profile', 'delivery:notice:login:one', { announcementId: 'notice', kind: null }],
    ['unknown source', 'delivery:unrecognized', { eventKey: 'result.recorded' }],
    ['mismatched event', 'delivery:another.event:one:login:one', { eventKey: 'result.recorded' }],
  ])('rejects %s atomically instead of broadening access', async (_label, id, options) => {
    await withDatabase(async (db) => {
      await insert(db, id, options)
      await expect(db.transaction(async (tx) => {
        await tx.exec(migration)
      })).rejects.toThrow()
      expect((await db.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'message_deliveries\' AND column_name = \'source_key\'')).rows).toEqual([])
      expect((await db.query('SELECT id FROM message_deliveries')).rows).toEqual([{ id }])
    })
  })

  test('rejects duplicate source/profile history rather than discarding either delivery', async () => {
    await withDatabase(async (db) => {
      await insert(db, 'first', { announcementId: 'notice' })
      await insert(db, 'second', { announcementId: 'notice' })
      await expect(db.transaction(async (tx) => {
        await tx.exec(migration)
      })).rejects.toThrow()
      expect((await db.query('SELECT count(*)::int AS count FROM message_deliveries')).rows).toEqual([{ count: 2 }])
    })
  })

  test('keeps different recipient profiles sharing a login distinct', async () => {
    await withDatabase(async (db) => {
      await insert(db, 'guardian-delivery', { announcementId: 'notice' })
      await insert(db, 'staff-delivery', { announcementId: 'notice', kind: 'staff', recipientId: 'staff' })
      await db.transaction(async (tx) => {
        await tx.exec(migration)
      })
      expect((await db.query('SELECT source_key, recipient_kind FROM message_deliveries ORDER BY recipient_kind')).rows).toEqual([{ source_key: 'notice', recipient_kind: 'guardian' }, { source_key: 'notice', recipient_kind: 'staff' }])
    })
  })
})
