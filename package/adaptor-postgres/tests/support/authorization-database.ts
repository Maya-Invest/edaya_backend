import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PGlite } from '@electric-sql/pglite'

export const migrationDirectory = resolve(import.meta.dir, '../../drizzle')
export const typedGrantsMigration = readFileSync(resolve(migrationDirectory, '0009_typed_staff_grants.sql'), 'utf8')

export async function installSchemaBeforeTypedGrants(db: PGlite): Promise<void> {
  for (const file of readdirSync(migrationDirectory).filter(name => /^000[0-8]_.*\.sql$/.test(name)).sort())
    await db.exec(readFileSync(resolve(migrationDirectory, file), 'utf8'))
}

export async function seedAuthorizationPlacement(db: PGlite): Promise<void> {
  await db.exec(`
    INSERT INTO schools (id, name, time_zone, created_at) VALUES ('school-a', 'A', 'UTC', now()), ('school-b', 'B', 'UTC', now());
    INSERT INTO academic_years (id, school_id, name, start_date, end_date, status, created_at) VALUES
      ('year-a', 'school-a', 'A', '2026-01-01', '2026-12-31', 'published', now()),
      ('year-old', 'school-a', 'Old', '2025-01-01', '2025-12-31', 'archived', now()),
      ('year-b', 'school-b', 'B', '2026-01-01', '2026-12-31', 'published', now());
    INSERT INTO staff_members (id, school_id, first_name, last_name, subject_id, is_active, created_at) VALUES
      ('staff-a', 'school-a', 'A', 'Staff', 'person-a', true, now()), ('staff-b', 'school-b', 'B', 'Staff', 'person-b', true, now());
    INSERT INTO grade_levels (id, school_id, name, label, order_val, created_at) VALUES
      ('level-a', 'school-a', 'A', 'A', 1, now()), ('level-b', 'school-b', 'B', 'B', 1, now());
    INSERT INTO class_groups (id, school_id, grade_level_id, name, academic_year_id, created_at) VALUES
      ('class-a', 'school-a', 'level-a', 'A', 'year-a', now()),
      ('class-other', 'school-a', 'level-a', 'Other', 'year-a', now()),
      ('class-old', 'school-a', 'level-a', 'Old', 'year-old', now()),
      ('class-b', 'school-b', 'level-b', 'B', 'year-b', now());
    INSERT INTO class_subjects (id, class_group_id, subject_id, created_at, completed_percentage) VALUES
      ('math-a', 'class-a', 'math', now(), 0), ('french-a', 'class-a', 'french', now(), 0),
      ('math-other', 'class-other', 'math', now(), 0), ('math-b', 'class-b', 'math', now(), 0);
  `)
}
