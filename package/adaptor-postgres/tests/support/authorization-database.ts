import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { PostgresAtomicExecution } from '../../src/lib/transaction'
import { PostgresSchoolRepositories } from '../../src/postgres-school-repositories'

export const migrationDirectory = resolve(import.meta.dir, '../../drizzle')
export const typedGrantsMigration = readFileSync(resolve(migrationDirectory, '0009_typed_staff_grants.sql'), 'utf8')

export async function installSchemaBeforeTypedGrants(db: PGlite): Promise<void> {
  for (const file of readdirSync(migrationDirectory).filter(name => /^000[0-8]_.*\.sql$/.test(name)).sort())
    await db.exec(readFileSync(resolve(migrationDirectory, file), 'utf8'))
}

export async function seedAuthorizationPlacement(db: PGlite): Promise<void> {
  await db.exec(`
    INSERT INTO schools (id, name, short_name, time_zone, finance_currency, created_at) VALUES ('school-a', 'A', 'A', 'UTC', 'USD', now()), ('school-b', 'B', 'B', 'UTC', 'USD', now());
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
    INSERT INTO subject_categories (id, school_id, name, created_at) VALUES
      ('category-a', 'school-a', 'General', now()),
      ('category-b', 'school-b', 'General', now());
    INSERT INTO subjects (id, school_id, name, category_id, created_at) VALUES
      ('math', 'school-a', 'Math', 'category-a', now()),
      ('french', 'school-a', 'French', 'category-a', now()),
      ('foreign-math', 'school-b', 'Math', 'category-b', now());
    INSERT INTO class_subjects (id, class_group_id, subject_id, created_at, completed_percentage) VALUES
      ('math-a', 'class-a', 'math', now(), 0), ('french-a', 'class-a', 'french', now(), 0),
      ('math-other', 'class-other', 'math', now(), 0), ('math-b', 'class-b', 'foreign-math', now(), 0);
  `)
}

export async function createRepositoryDatabase() {
  const db = new PGlite()
  const connection = drizzle(db)
  const repositories = new PostgresSchoolRepositories(connection)
  await repositories.init({ driver: 'pglite' })
  return { db, connection, repositories, atomic: new PostgresAtomicExecution(connection) }
}

export async function createAuthorizationDatabase() {
  const fixture = await createRepositoryDatabase()
  await seedAuthorizationPlacement(fixture.db)
  return fixture
}

export async function seedAuthorizationRelationships(db: PGlite): Promise<void> {
  await db.exec(`
      INSERT INTO academic_periods (id, school_id, academic_year_id, name, start_date, end_date, created_at) VALUES
        ('period-a', 'school-a', 'year-a', 'A', '2026-01-01', '2026-06-01', now()), ('period-b', 'school-b', 'year-b', 'B', '2026-01-01', '2026-06-01', now());
      INSERT INTO students (id, school_id, first_name, last_name, status, created_at) VALUES
        ('student-a', 'school-a', 'A', 'Student', 'active', now()), ('student-other', 'school-a', 'Other', 'Student', 'active', now()),
        ('student-b', 'school-b', 'B', 'Student', 'active', now());
      INSERT INTO student_class_enrollments (id, student_id, class_group_id, academic_year_id, enrollment_index, status, enrolled_at, created_at) VALUES
        ('enrollment-a', 'student-a', 'class-a', 'year-a', 1, 'active', '2026-01-01', now()),
        ('enrollment-other', 'student-other', 'class-other', 'year-a', 1, 'active', '2026-01-01', now()),
        ('enrollment-b', 'student-b', 'class-b', 'year-b', 1, 'active', '2026-01-01', now());
      INSERT INTO assessments (id, class_group_id, class_subject_id, period_id, title, kind, max_score, coefficient, due_at, created_at) VALUES
        ('assessment-math', 'class-a', 'math-a', 'period-a', 'Math', 'homework', 20, 1, '2026-05-01', now()),
        ('assessment-french', 'class-a', 'french-a', 'period-a', 'French', 'homework', 20, 1, '2026-05-01', now()),
        ('assessment-other', 'class-other', 'math-other', 'period-a', 'Other', 'homework', 20, 1, '2026-05-01', now()),
        ('assessment-b', 'class-b', 'math-b', 'period-b', 'B', 'homework', 20, 1, '2026-05-01', now());
      INSERT INTO assessment_results (id, assessment_id, student_id, score, created_at) VALUES
        ('1-math', 'assessment-math', 'student-a', 10, now()), ('2-french', 'assessment-french', 'student-a', 12, now()),
        ('3-other', 'assessment-other', 'student-other', 14, now()), ('4-foreign', 'assessment-b', 'student-b', 16, now());
      INSERT INTO teachers (id, school_id, first_name, last_name, subject_id, is_active, created_at) VALUES ('teacher-a', 'school-a', 'A', 'Teacher', 'person-a', true, now());
      INSERT INTO teacher_assignments (id, teacher_id, academic_year_id, kind, class_subject_id, status, created_at) VALUES
        ('teaching', 'teacher-a', 'year-a', 'subject', 'math-a', 'active', now());
      INSERT INTO guardians (id, school_id, first_name, last_name, subject_id, has_access, contact_methods, created_at) VALUES ('guardian-a', 'school-a', 'A', 'Guardian', 'person-a', true, '[]', now());
      INSERT INTO guardian_student_links (id, school_id, guardian_id, student_id, relationship, is_primary, created_at) VALUES
        ('guardian-link', 'school-a', 'guardian-a', 'student-a', 'parent', true, now());
    `)
}
