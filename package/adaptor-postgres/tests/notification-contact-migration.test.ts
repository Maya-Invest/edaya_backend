import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { NOTIFY_SCHEMA_SQL } from '../../adaptor-notify/src/store/schema'
import { migrationDirectory } from './support/authorization-database'

const migration = readFileSync(resolve(migrationDirectory, '0012_notification_contact_authority.sql'), 'utf8')
async function fixture(run: (db: PGlite) => Promise<void>) {
  const db = new PGlite()
  try {
    await db.exec(NOTIFY_SCHEMA_SQL)
    await db.exec(`ALTER TABLE notify.recipients DROP CONSTRAINT command_notification_destination;
      INSERT INTO notify.recipients (subject_id, tenant, email, recipient_id) VALUES
        ('school-person', 'school', 'old@example.test', 'guardian'),
        ('unlinked', 'school', NULL, NULL),
        ('auth:login@example.test', 'platform', 'login@example.test', 'login@example.test'),
        ('invite:invitation', 'school', 'invite@example.test', 'invitation');
      INSERT INTO notify.jobs (idempotency_key, tenant, job_kind, event_key, title, body) VALUES
        ('school-delivery', 'school', 'school', 'announcement.published', 'Title', 'Body'),
        ('invitation', 'school', 'invitation', 'account_invitation', 'Join', 'Invitation');
      INSERT INTO notify.job_recipients (idempotency_key, subject_id, channel) VALUES
        ('school-delivery', 'school-person', 'queued'), ('invitation', 'invite:invitation', 'queued');`)
    await run(db)
  }
  finally { await db.close() }
}

test('offline contact retirement preserves explicit destinations and queued receipts', async () => {
  await fixture(async (db) => {
    const jobs = (await db.query('SELECT * FROM notify.jobs ORDER BY idempotency_key')).rows
    const receipts = (await db.query('SELECT * FROM notify.job_recipients ORDER BY idempotency_key')).rows
    await db.transaction(tx => tx.exec(migration))
    expect((await db.query('SELECT subject_id FROM notify.recipients ORDER BY subject_id')).rows).toEqual([{ subject_id: 'auth:login@example.test' }, { subject_id: 'invite:invitation' }])
    expect((await db.query('SELECT * FROM notify.jobs ORDER BY idempotency_key')).rows).toEqual(jobs)
    expect((await db.query('SELECT * FROM notify.job_recipients ORDER BY idempotency_key')).rows).toEqual(receipts)
    await expect(db.exec('INSERT INTO notify.recipients (subject_id, tenant) VALUES (\'school-person\', \'school\')')).rejects.toThrow('command_notification_destination')
  })
})

test('ambiguous command destination aborts retirement without losing contacts', async () => {
  await fixture(async (db) => {
    await db.exec('UPDATE notify.recipients SET recipient_id = \'guardian\' WHERE subject_id = \'invite:invitation\'')
    await expect(db.transaction(tx => tx.exec(migration))).rejects.toThrow('Ambiguous command notification destination')
    expect((await db.query('SELECT count(*)::int AS count FROM notify.recipients')).rows).toEqual([{ count: 4 }])
  })
})

test('a database without native notification tables needs no contact conversion', async () => {
  const db = new PGlite()
  try {
    await db.exec(migration)
  }
  finally { await db.close() }
})
