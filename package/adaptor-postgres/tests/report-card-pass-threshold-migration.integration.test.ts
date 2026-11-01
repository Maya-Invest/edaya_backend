import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'

test('report threshold migration retains snapshots and supports optional thresholds with three decimals', async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE TABLE report_card_definitions (id text PRIMARY KEY); CREATE TABLE report_card_results (id text PRIMARY KEY, pass_threshold numeric(8,2)); INSERT INTO report_card_definitions VALUES (\'model\'); INSERT INTO report_card_results VALUES (\'published\',10);')
    await db.exec(await readFile(new URL('../drizzle/0042_report_card_pass_threshold.sql', import.meta.url), 'utf8'))
    expect((await db.query('SELECT pass_threshold FROM report_card_definitions')).rows[0]).toEqual({ pass_threshold: null })
    expect((await db.query('SELECT pass_threshold::float8 AS value FROM report_card_results')).rows[0]).toEqual({ value: 10 })
    await db.exec('UPDATE report_card_definitions SET pass_threshold = 10.125; INSERT INTO report_card_results VALUES (\'new\',10.125)')
    expect((await db.query('SELECT pass_threshold::float8 AS value FROM report_card_definitions')).rows[0]).toEqual({ value: 10.125 })
    expect((await db.query('SELECT pass_threshold::float8 AS value FROM report_card_results WHERE id = \'new\'')).rows[0]).toEqual({ value: 10.125 })
    await db.exec('UPDATE report_card_definitions SET pass_threshold = NULL')
    expect((await db.query('SELECT pass_threshold FROM report_card_definitions')).rows[0]).toEqual({ pass_threshold: null })
  }
  finally { await db.close() }
})
