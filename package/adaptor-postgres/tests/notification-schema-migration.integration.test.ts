import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { runMigrations } from '../src/lib/migrate'

test('school migrations install notification persistence on a fresh database and can rerun', async () => {
  const db = new PGlite()
  try {
    const connection = drizzle(db)
    await runMigrations(connection, { driver: 'pglite' })
    await db.exec(`INSERT INTO notify.jobs (idempotency_key, delivery_id, tenant, job_kind, event_key, title, body)
      VALUES ('persisted', 'persisted', 'school', 'school', 'test', 'Synthetic', 'Fixture')`)
    await runMigrations(connection, { driver: 'pglite' })
    expect((await db.query('SELECT idempotency_key FROM notify.jobs')).rows).toEqual([{ idempotency_key: 'persisted' }])
    expect((await db.query('SELECT tablename FROM pg_tables WHERE schemaname = \'notify\' ORDER BY tablename')).rows)
      .toEqual(['devices', 'devices_pre_installation', 'devices_unscoped_legacy', 'job_recipients', 'jobs', 'recipients'].map(tablename => ({ tablename })))
    expect((await db.query('SELECT indexname FROM pg_indexes WHERE indexname = \'notify_jobs_pending_idx\'')).rows).toHaveLength(1)
  }
  finally { await db.close() }
}, 30000)

test('migration adopts legacy notification rows and channel completion without resending or dropping data', async () => {
  const db = new PGlite()
  try {
    await db.exec(readFileSync(new URL('./fixtures/legacy-notify.sql', import.meta.url), 'utf8'))
    await db.exec(`INSERT INTO notify.jobs (idempotency_key, tenant, job_kind, event_key, title, body, status)
      VALUES ('partial', 'school', 'school', 'test', 'Synthetic', 'Fixture', 'failed');
      INSERT INTO notify.job_recipients (idempotency_key, subject_id, channel, status)
      VALUES ('partial', 'subject', 'email', 'sent'), ('partial', 'subject', 'push', 'failed');
      INSERT INTO notify.devices (subject_id, provider, token) VALUES ('subject', 'fcm', 'synthetic-device')`)
    const before = (await db.query('SELECT * FROM notify.job_recipients ORDER BY channel')).rows
    const migration = readFileSync(new URL('../drizzle/0013_notification_schema.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    await db.exec(migration)
    expect((await db.query('SELECT * FROM notify.job_recipients ORDER BY channel')).rows).toEqual(before)
    expect((await db.query('SELECT status FROM notify.jobs')).rows).toEqual([{ status: 'failed' }])
    expect((await db.query('SELECT token FROM notify.devices')).rows).toEqual([{ token: 'synthetic-device' }])
  }
  finally { await db.close() }
})
