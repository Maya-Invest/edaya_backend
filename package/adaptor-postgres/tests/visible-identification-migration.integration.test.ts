import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { migrationDirectory } from './support/authorization-database'

const migration = await Bun.file(join(migrationDirectory, '0054_visible_identification.sql')).text()

test('a populated school upgrades in place and conflicting person IDs can be repaired and retried', async () => {
  const db = new PGlite()
  try {
    for (const file of readdirSync(migrationDirectory).filter(file => /^\d{4}_.+\.sql$/.test(file) && file < '0054_').sort())
      await db.exec(await Bun.file(join(migrationDirectory, file)).text())
    await db.exec(`
      INSERT INTO schools (id, name, short_name, time_zone, created_at) VALUES ('s', 'School', 'SCH', 'UTC', now());
      INSERT INTO students (id, school_id, first_name, last_name, status, matricule, national_matricule, created_at) VALUES
        ('a', 's', 'A', 'One', 'active', ' ａｂ-001 ', '00/123', now()),
        ('b', 's', 'B', 'Two', 'active', 'AB-001', NULL, now()),
        ('c', 'other', 'C', 'Three', 'active', 'AB-001', NULL, now());
      INSERT INTO guardians (id, school_id, first_name, last_name, created_at) VALUES ('g', 's', 'A', 'Guardian', now());
      INSERT INTO guardian_student_links (id, school_id, guardian_id, student_id, relationship, is_primary, created_at)
        VALUES ('link', 's', 'g', 'a', 'parent', true, now());
      INSERT INTO teachers (id, school_id, first_name, last_name, code, created_at) VALUES ('t', 's', 'T', 'One', '0001', now());
      INSERT INTO staff_members (id, school_id, first_name, last_name, account_kind, service_id, code, is_active, created_at) VALUES
        ('h', 's', 'H', 'One', 'human', NULL, NULL, true, now()),
        ('bot', 's', 'Payroll', 'Sync', 'service', 'payroll', 'PAY', true, now());
      INSERT INTO service_api_keys (id, staff_member_id, school_id, key_prefix, key_hash, created_by_subject_id, created_at)
        VALUES ('key', 'bot', 's', 'prefix', 'fixture', 'owner', now());
      INSERT INTO academic_years (id, school_id, name, start_date, end_date, status, created_at)
        VALUES ('year', 's', 'School year with a very long display name', now(), now(), 'published', now());
      INSERT INTO grade_levels (id, school_id, name, label, order_val, created_at) VALUES ('grade', 's', 'Grade one', 'G1', 1, now());
      INSERT INTO academic_disciplines (id, school_id, name, code, created_at, updated_at) VALUES ('d', 's', 'Language', 'LANG', now(), now());
      INSERT INTO placement_statuses (id, school_id, label, code, created_at, updated_at) VALUES ('p', 's', 'Admitted', 'ADM', now(), now());
      INSERT INTO subject_categories (id, school_id, name, created_at) VALUES ('category', 's', 'Sciences', now());
      INSERT INTO subjects (id, school_id, name, code, short_name, grade_level_id, academic_year_id, category_id, created_at) VALUES
        ('math', 's', 'Mathematics', 'M01', 'Math', 'grade', 'year', 'category', now()),
        ('physics', 's', 'Physics', 'PHY', NULL, 'grade', 'year', 'category', now());
    `)

    const upgrade = () => db.transaction(tx => tx.exec(migration))
    await expect(upgrade()).rejects.toThrow('Duplicate legacy identifier on students rows a and b')
    await db.exec('UPDATE students SET matricule = \'has/slash\' WHERE id = \'b\'')
    await expect(upgrade()).rejects.toThrow('Invalid legacy identifier on students row b')
    expect((await db.query('SELECT matricule FROM students WHERE id = \'a\'')).rows).toEqual([{ matricule: ' ａｂ-001 ' }])
    await db.exec('UPDATE students SET matricule = NULL WHERE id = \'b\'')
    await upgrade()
    for (const file of ['0055_optional_human_identifiers.sql', '0056_subject_legacy_code.sql'])
      await db.exec(await Bun.file(join(migrationDirectory, file)).text())

    expect((await db.query('SELECT id, identifier, global_identifier FROM students ORDER BY id')).rows).toEqual([
      { id: 'a', identifier: 'AB-001', global_identifier: '00/123' },
      { id: 'b', identifier: null, global_identifier: null },
      { id: 'c', identifier: 'AB-001', global_identifier: null },
    ])
    expect((await db.query('SELECT guardian_id, student_id FROM guardian_student_links')).rows).toEqual([{ guardian_id: 'g', student_id: 'a' }])
    expect((await db.query('SELECT identifier FROM guardians')).rows).toEqual([{ identifier: null }])
    expect((await db.query('SELECT identifier FROM teachers')).rows).toEqual([{ identifier: '0001' }])
    expect((await db.query('SELECT identifier, name, short_name FROM staff_members ORDER BY id')).rows).toEqual([
      { identifier: null, name: 'Payroll Sync', short_name: 'PAY' },
      { identifier: null, name: null, short_name: null },
    ])
    expect((await db.query('SELECT s.service_id FROM service_api_keys k JOIN staff_members s ON k.staff_member_id = s.id')).rows).toEqual([{ service_id: 'payroll' }])
    expect((await db.query('SELECT legacy_code, short_name FROM subjects ORDER BY id')).rows).toEqual([
      { legacy_code: 'M01', short_name: 'Math' },
      { legacy_code: 'PHY', short_name: 'PHY' },
    ])
    for (const [table, expected] of Object.entries({
      schools: 'SCH',
      academic_years: 'School year with a very long dis',
      grade_levels: 'G1',
      subject_categories: 'Sciences',
      academic_disciplines: 'LANG',
      placement_statuses: 'ADM',
    })) {
      expect((await db.query(`SELECT short_name FROM ${table}`)).rows).toEqual([{ short_name: expected }])
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
