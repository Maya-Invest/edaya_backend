import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { buildNotifyJobId } from '../../adaptor-notify/src/ids'

const migration = (name: string) => readFileSync(new URL(`../drizzle/${name}.sql`, import.meta.url), 'utf8')

test('tenant migration preserves channel history, handles namespace-like IDs and isolates unscoped device tokens', async () => {
  const db = new PGlite()
  try {
    await db.exec(migration('0013_notification_schema'))
    const tenant = 'école:"A"'
    const ids = ['one', buildNotifyJobId('school', tenant, 'one')]
    for (const id of ids) {
      await db.query('INSERT INTO notify.jobs (idempotency_key, tenant, job_kind, event_key, title, body, status, attempts) VALUES ($1,$2,\'school\',\'fixture\',\'Title\',\'Body\',\'failed\',2)', [id, tenant])
      await db.query('INSERT INTO notify.job_recipients (idempotency_key,subject_id,channel,status,provider_message_id) VALUES ($1,\'login\',\'email\',\'sent\',\'provider-history\'), ($1,\'login\',\'push\',\'failed\',NULL)', [id])
    }
    await db.exec('INSERT INTO notify.devices (subject_id,provider,token) VALUES (\'login\',\'fcm\',\'synthetic-legacy-token\')')
    await db.exec(migration('0016_notification_tenants'))
    expect((await db.query('SELECT delivery_id, idempotency_key, status, attempts FROM notify.jobs ORDER BY delivery_id')).rows).toEqual(
      ids.sort().map(id => ({ delivery_id: id, idempotency_key: buildNotifyJobId('school', tenant, id), status: 'failed', attempts: 2 })),
    )
    expect((await db.query('SELECT status, provider_message_id FROM notify.job_recipients WHERE channel = \'email\'')).rows).toEqual([
      { status: 'sent', provider_message_id: 'provider-history' },
      { status: 'sent', provider_message_id: 'provider-history' },
    ])
    expect((await db.query('SELECT * FROM notify.devices')).rows).toEqual([])
    expect((await db.query('SELECT token FROM notify.devices_unscoped_legacy')).rows).toEqual([{ token: 'synthetic-legacy-token' }])
  }
  finally { await db.close() }
}, 30000)

test('tenant migration refuses orphan history before changing keys or device storage', async () => {
  const db = new PGlite()
  try {
    await db.exec(migration('0013_notification_schema'))
    await db.exec('INSERT INTO notify.job_recipients (idempotency_key,subject_id,channel) VALUES (\'missing\',\'login\',\'email\')')
    await expect(db.exec(migration('0016_notification_tenants'))).rejects.toThrow('NOTIFY_ORPHAN_DELIVERY_HISTORY')
    expect((await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema = \'notify\' AND table_name = \'jobs\' AND column_name = \'delivery_id\'')).rows).toEqual([])
    expect((await db.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'notify\' AND table_name = \'devices_unscoped_legacy\'')).rows).toEqual([])
  }
  finally { await db.close() }
}, 30000)
