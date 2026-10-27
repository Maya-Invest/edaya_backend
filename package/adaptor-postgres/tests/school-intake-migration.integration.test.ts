import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { migrationDirectory } from './support/authorization-database'

test('intake migration preserves populated legacy records and enforces natural-key uniqueness', async () => {
  const db = new PGlite()
  try {
    for (const file of readdirSync(migrationDirectory).filter(file => /^\d{4}_.*\.sql$/.test(file) && file < '0046_').sort())
      await db.exec(readFileSync(join(migrationDirectory, file), 'utf8'))
    await db.exec(`INSERT INTO schools (id, name, short_name, time_zone, finance_currency, created_at) VALUES ('school', 'Legacy', 'LEG', 'UTC', 'USD', now());
      INSERT INTO students (id, school_id, first_name, last_name, status, matricule, created_at) VALUES ('student', 'school', 'Compound first', 'Compound last', 'graduated', '0001', now());`)
    await db.exec(readFileSync(join(migrationDirectory, '0046_school_intake_profiles.sql'), 'utf8'))
    expect((await db.query(`SELECT first_name, last_name, matricule, status, national_matricule, source_full_name FROM students WHERE id = 'student'`)).rows).toEqual([{ first_name: 'Compound first', last_name: 'Compound last', matricule: '0001', status: 'graduated', national_matricule: null, source_full_name: null }])
    expect((await db.query(`SELECT count(*)::int AS count FROM student_academic_year_profiles`)).rows).toEqual([{ count: 0 }])
    await db.exec(`INSERT INTO academic_disciplines (id, school_id, code, name, created_at, updated_at) VALUES ('d1', 'school', 'SCI', 'Science', now(), now());`)
    await expect(db.exec(`INSERT INTO academic_disciplines (id, school_id, code, name, created_at, updated_at) VALUES ('d2', 'school', 'sci', 'Duplicate', now(), now());`)).rejects.toBeDefined()
    await db.exec(`INSERT INTO student_academic_year_profiles (id, school_id, student_id, academic_year_id, is_repeating, created_at, updated_at) VALUES ('p1', 'school', 'student', 'year', false, now(), now());`)
    await expect(db.exec(`INSERT INTO student_academic_year_profiles (id, school_id, student_id, academic_year_id, created_at, updated_at) VALUES ('p2', 'school', 'student', 'year', now(), now());`)).rejects.toBeDefined()
    expect((await db.query(`SELECT is_repeating FROM student_academic_year_profiles`)).rows).toEqual([{ is_repeating: false }])
  }
  finally { await db.close() }
})
