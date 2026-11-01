import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { migrationDirectory } from './support/authorization-database'

test('automatic billing migration leaves every existing fee off and creates no work or charges', async () => {
  const db = new PGlite()
  try {
    for (const file of readdirSync(migrationDirectory).filter(file => /^\d{4}_.*\.sql$/.test(file) && file < '0049_').sort())
      await db.exec(readFileSync(join(migrationDirectory, file), 'utf8'))
    await db.exec(`INSERT INTO catalog_services (id,school_id,academic_year_id,name,category,enrollment_mode,billing_kind,default_price,currency,billing_terms,status,created_at)
      VALUES ('mandatory','school','year','Required','tuition','mandatory','one_time',1000,'USD','{"kind":"one_time","installments":[]}', 'active',now()),
      ('optional','school','year','Optional','other','opt_in','one_time',500,'USD','{"kind":"one_time","installments":[]}', 'active',now());`)
    await db.exec(readFileSync(join(migrationDirectory, '0049_auto_billing.sql'), 'utf8'))
    expect((await db.query('SELECT id, auto_billing FROM catalog_services ORDER BY id')).rows).toEqual([
      { id: 'mandatory', auto_billing: { mode: 'off' } },
      { id: 'optional', auto_billing: { mode: 'off' } },
    ])
    expect((await db.query('SELECT count(*)::int AS count FROM auto_billing_runs')).rows).toEqual([{ count: 0 }])
    expect((await db.query('SELECT count(*)::int AS count FROM student_charges')).rows).toEqual([{ count: 0 }])
    expect((await db.query('SELECT count(*)::int AS count FROM command_outbox')).rows).toEqual([{ count: 0 }])
  }
  finally { await db.close() }
})
