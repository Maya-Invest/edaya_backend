import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'

const migration = await Bun.file(new URL('../drizzle/0054_visible_identification.sql', import.meta.url)).text()
const affected = ['students', 'teachers', 'guardians', 'staff_members', 'schools', 'academic_years', 'academic_periods', 'grade_levels', 'period_definitions', 'subject_categories', 'subjects', 'subject_matters', 'class_groups', 'activities', 'grade_scales', 'report_modules', 'catalog_services', 'disciplinary_actions', 'resources', 'staff_permission_profiles', 'academic_disciplines', 'placement_statuses']

test('the cutover refuses every populated affected table before changing the schema or data', async () => {
  const db = new PGlite()
  try {
    for (const table of affected)
      await db.exec(`CREATE TABLE ${table} (id text PRIMARY KEY)`)
    for (const table of affected) {
      await db.exec(`INSERT INTO ${table} VALUES ('retained')`)
      await expect(db.exec(migration)).rejects.toThrow('requires a clean school database')
      expect((await db.query(`SELECT id FROM ${table}`)).rows).toEqual([{ id: 'retained' }])
      await db.exec(`DELETE FROM ${table}`)
    }
  }
  finally { await db.close() }
}, 60000)

test('optional human identifiers preserve existing people and scope uniqueness on a populated school', async () => {
  const db = new PGlite()
  const optional = await Bun.file(new URL('../drizzle/0055_optional_human_identifiers.sql', import.meta.url)).text()
  try {
    for (const table of ['students', 'teachers', 'guardians']) {
      await db.exec(`CREATE TABLE ${table} (id text PRIMARY KEY, school_id text NOT NULL, identifier text NOT NULL, UNIQUE (school_id, identifier));
        INSERT INTO ${table} VALUES ('original', 'school', '0001')`)
    }
    await db.exec(`CREATE TABLE staff_members (account_kind text, identifier text, name text, short_name text,
      CONSTRAINT staff_visible_identity CHECK (account_kind = 'service' OR identifier IS NOT NULL))`)
    await db.exec(optional)
    for (const table of ['students', 'teachers', 'guardians']) {
      await db.exec(`INSERT INTO ${table} VALUES ('one', 'school', NULL), ('two', 'school', NULL), ('other', 'other-school', '0001')`)
      expect((await db.query(`SELECT identifier FROM ${table} WHERE id = 'original'`)).rows).toEqual([{ identifier: '0001' }])
      await expect(db.exec(`INSERT INTO ${table} VALUES ('duplicate', 'school', '0001')`)).rejects.toThrow()
    }
    await db.exec('INSERT INTO staff_members VALUES (\'human\', NULL, NULL, NULL), (\'service\', NULL, \'Service account\', \'Service\')')
    await expect(db.exec('INSERT INTO staff_members VALUES (\'service\', \'001\', \'Service account\', \'Service\')')).rejects.toThrow()
  }
  finally { await db.close() }
})
