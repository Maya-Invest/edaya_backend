import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'

const migration = readFileSync(new URL('../drizzle/0051_flat_guardian_contacts.sql', import.meta.url), 'utf8')
async function database() {
  const db = new PGlite()
  await db.exec('CREATE TABLE guardians (id text PRIMARY KEY, phone text, email text, contact_methods jsonb NOT NULL, notification_email text, notification_phone text)')
  return db
}

test('fresh database migration stores flat contacts and enabled defaults', async () => {
  const db = await database()
  try {
    await db.exec(migration)
    await db.exec('INSERT INTO guardians (id, phone, alternative_phone, email) VALUES (\'guardian\', \'+22501020304\', \'+22505060708\', \'guardian@example.test\')')
    expect((await db.query('SELECT * FROM guardians')).rows).toEqual([{ id: 'guardian', phone: '+22501020304', alternative_phone: '+22505060708', email: 'guardian@example.test', email_notifications_enabled: true, sms_notifications_enabled: true, push_notifications_enabled: true }])
  }
  finally { await db.close() }
})

test('populated guardians stop the destructive cutover without losing data', async () => {
  const db = await database()
  try {
    await db.exec('INSERT INTO guardians (id, contact_methods) VALUES (\'guardian\', \'[{"type":"other","value":"preserve"}]\')')
    const before = (await db.query('SELECT * FROM guardians')).rows
    await expect(db.exec(migration)).rejects.toThrow('empty guardian table')
    expect((await db.query('SELECT * FROM guardians')).rows).toEqual(before)
  }
  finally { await db.close() }
})
