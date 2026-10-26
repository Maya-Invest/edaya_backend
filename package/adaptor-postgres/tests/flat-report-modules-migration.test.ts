import { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'bun:test'

const migration = await Bun.file(new URL('../drizzle/0052_flat_report_modules.sql', import.meta.url)).text()
async function fixture() {
  const db = new PGlite()
  await db.exec(`CREATE TABLE report_card_definitions(id text PRIMARY KEY);
    CREATE TABLE report_card_definition_sections(id text PRIMARY KEY);
    CREATE TABLE report_card_results(id text PRIMARY KEY, student_id text, period_id text, report_card_definition_id text);
    CREATE TABLE subjects(id text PRIMARY KEY);
    CREATE TABLE grade_levels(id text PRIMARY KEY);`)
  return db
}
describe('flat report module cutover', () => {
  test('installs on empty school data and enforces weighting modes', async () => {
    const db = await fixture()
    try {
      await db.exec(migration)
      await db.exec('INSERT INTO report_modules VALUES (\'science\',\'school\',\'grade\',\'year\',\'Science\',1,\'explicit\',2,NOW())')
      await expect(db.exec('INSERT INTO report_modules VALUES (\'invalid\',\'school\',\'grade\',\'year\',\'Invalid\',2,\'explicit\',0,NOW())')).rejects.toThrow()
      await expect(db.exec('INSERT INTO report_modules VALUES (\'invalid\',\'school\',\'grade\',\'year\',\'Invalid\',2,\'subject_coefficients\',2,NOW())')).rejects.toThrow()
      await db.exec('INSERT INTO subjects(id, report_module_id) VALUES (\'math\', \'science\'); DELETE FROM report_modules WHERE id=\'science\'')
      expect((await db.query<{ report_module_id: string | null }>('SELECT report_module_id FROM subjects')).rows[0]?.report_module_id).toBeNull()
    }
    finally { await db.close() }
  })
  for (const table of ['report_card_definitions', 'report_card_definition_sections', 'report_card_results']) {
    test(`refuses populated ${table} without dropping data`, async () => {
      const db = await fixture()
      try {
        await db.exec(`INSERT INTO ${table}(id) VALUES ('retained')`)
        await expect(db.exec(migration)).rejects.toThrow('require an empty school database')
        expect((await db.query<{ id: string }>(`SELECT id FROM ${table}`)).rows).toEqual([{ id: 'retained' }])
      }
      finally { await db.close() }
    })
  }
})
