import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { migrationDirectory } from './support/authorization-database'

const cutover = readFileSync(resolve(migrationDirectory, '0044_grade_year_subjects.sql'), 'utf8')
async function beforeCutover() {
  const db = new PGlite()
  for (const file of readdirSync(migrationDirectory).filter(name => /^\d{4}_.*\.sql$/.test(name) && name < '0044').sort())
    await db.exec(readFileSync(resolve(migrationDirectory, file), 'utf8'))
  return db
}
test('fresh subject cutover installs grade/year fields and unique class offerings', async () => {
  const db = await beforeCutover()
  try {
    for (const statement of cutover.split('--> statement-breakpoint')) await db.query(statement)
    const columns = await db.query<{ column_name: string }>('SELECT column_name FROM information_schema.columns WHERE table_name = \'subjects\'')
    expect(columns.rows.map(row => row.column_name)).toContain('grade_level_id')
    expect(columns.rows.map(row => row.column_name)).not.toContain('default_coefficient')
    expect((await db.query('SELECT to_regclass(\'grade_level_subjects\') AS legacy')).rows).toEqual([{ legacy: null }])
    await db.exec('INSERT INTO class_subjects (id, class_group_id, subject_id, completed_percentage, created_at) VALUES (\'one\', \'class\', \'subject\', 0, now())')
    await expect(db.exec('INSERT INTO class_subjects (id, class_group_id, subject_id, completed_percentage, created_at) VALUES (\'two\', \'class\', \'subject\', 0, now())')).rejects.toThrow()
  }
  finally { await db.close() }
}, 30_000)
test('cutover refuses populated legacy subjects instead of discarding them', async () => {
  const db = await beforeCutover()
  try {
    await db.exec('INSERT INTO subjects (id, school_id, name, category_id, created_at) VALUES (\'math\', \'school\', \'Math\', \'category\', now())')
    await expect(db.exec(cutover)).rejects.toThrow('fresh school database')
    expect((await db.query('SELECT id FROM subjects')).rows).toEqual([{ id: 'math' }])
  }
  finally { await db.close() }
}, 30_000)
