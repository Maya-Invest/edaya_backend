import type { StaffPermissionAssignmentInput } from '@edaya/core'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AccessPolicies, createStaffActorMetadata } from '@edaya/authorization'
import { Permission, StaffPermissionAssignment } from '@edaya/core'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { PostgresSchoolRepositories } from '../src/postgres-school-repositories'
import { installSchemaBeforeTypedGrants, migrationDirectory, typedGrantsMigration } from './support/authorization-database'

import { seedPre0009AuthorizationPlacement, seedPre0009AuthorizationRelationships } from './support/pre-0009-authorization-fixture'

describe('typed staff grants coordinated migration', () => {
  let db: PGlite
  beforeEach(async () => {
    db = new PGlite()
    await installSchemaBeforeTypedGrants(db)
    await seedPre0009AuthorizationPlacement(db)
  })
  afterEach(async () => {
    await db.close()
  })

  async function grant(id: string, permission: string, path: string, source: string | null = null) {
    await db.query(`INSERT INTO staff_permission_assignments
      (id, staff_id, school_id, academic_year_id, permission, scope_ids, source_staff_assignment_id, status, created_at, updated_at)
      VALUES ($1, 'staff-a', 'school-a', 'year-a', $2, $3, $4, 'active', '2026-01-01', '2026-02-01')`, [id, permission, path, source])
  }
  async function migrate() {
    await db.transaction(async (tx) => {
      await tx.exec(typedGrantsMigration)
    })
  }

  test('preserves manual provenance, status, validity, action and class/subject wildcard meaning', async () => {
    await grant('manual', 'GRADE_INPUT', 'class-a;class-other,class-a')
    await grant('subject', 'EXAM_CONFIG_CREATE', 'class-a:math-a,class-other:*')
    await grant('all-classes', 'GRADE_READ', '*')
    await grant('all-subjects', 'EXAM_CONFIG_READ', '*:*')
    await grant('school', 'PAYMENT_RECORD', '')
    await db.exec('UPDATE staff_permission_assignments SET status = \'inactive\', starts_at = \'2026-03-01\', ends_at = \'2026-07-01\' WHERE id = \'manual\'')
    await migrate()
    const { rows } = await db.query<{ id: string, scopes: unknown, status: string, starts_at: Date, ends_at: Date, created_at: Date, updated_at: Date }>('SELECT * FROM staff_permission_assignments ORDER BY id')
    const byId = new Map(rows.map(row => [row.id, row]))
    expect(byId.get('manual')?.scopes).toEqual([{ kind: 'class_group', classGroupId: 'class-a' }, { kind: 'class_group', classGroupId: 'class-other' }])
    expect(byId.get('manual')?.status).toBe('inactive')
    expect(byId.get('manual')?.starts_at.toISOString()).toBe('2026-03-01T00:00:00.000Z')
    expect(byId.get('manual')?.ends_at.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(byId.get('manual')?.created_at.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(byId.get('manual')?.updated_at.toISOString()).toBe('2026-02-01T00:00:00.000Z')
    expect(byId.get('subject')?.scopes).toEqual([{ kind: 'class_subject', classGroupId: 'class-a', classSubjectId: 'math-a' }, { kind: 'class_subject', classGroupId: 'class-other' }])
    expect(byId.get('all-classes')?.scopes).toEqual([{ kind: 'all', grain: 'class_group' }])
    expect(byId.get('all-subjects')?.scopes).toEqual([{ kind: 'all', grain: 'class_subject' }])
    expect(byId.get('school')?.scopes).toEqual([{ kind: 'school' }])
    const columns = await db.query<{ column_name: string }>('SELECT column_name FROM information_schema.columns WHERE table_name = \'staff_permission_assignments\'')
    expect(columns.rows.map(row => row.column_name)).not.toContain('scope_ids')
    expect(columns.rows.map(row => row.column_name)).not.toContain('source_staff_assignment_id')
  })

  test('converted wildcard and subject grants retain their meaning in native policy queries', async () => {
    await seedPre0009AuthorizationRelationships(db)
    await grant('grades', 'GRADE_READ', '*')
    await grant('exams', 'EXAM_CONFIG_READ', 'class-a:math-a,class-other:*')
    await migrate()
    for (const file of readdirSync(migrationDirectory).filter(name => /^\d{4}_.*\.sql$/.test(name) && name >= '0010' && name < '0037').sort())
      await db.exec(readFileSync(resolve(migrationDirectory, file), 'utf8'))
    // Current repositories require the clean-cutover schema. Recreate these explicit
    // fixture grants after clearing the old permission rows; no legacy source migrates.
    const converted = await db.query<StaffPermissionAssignmentInput>(`SELECT id, staff_id AS "staffId", school_id AS "schoolId", academic_year_id AS "academicYearId", permission, scopes FROM staff_permission_assignments`)
    await db.exec('DELETE FROM staff_permission_assignments')
    await db.exec(readFileSync(resolve(migrationDirectory, '0037_permission_scope_defaults.sql'), 'utf8'))
    const marksBefore = await db.query('SELECT id, score FROM assessment_results ORDER BY id')
    for (const file of readdirSync(migrationDirectory).filter(name => /^\d{4}_.*\.sql$/.test(name) && name >= '0038').sort())
      await db.exec(readFileSync(resolve(migrationDirectory, file), 'utf8'))
    expect((await db.query('SELECT id, score FROM assessment_results ORDER BY id')).rows).toEqual(marksBefore.rows)
    const repositories = new PostgresSchoolRepositories(drizzle(db))
    for (const row of converted.rows) await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment(row))
    const access = new AccessPolicies(createStaffActorMetadata({ schoolId: 'school-a', staffMemberId: 'staff-a', subjectId: 'person-a', academicYearId: 'year-a', requestId: 'migrated-grants', authenticatedAt: new Date() }), repositories)
    const grades = repositories.assessmentResults.forAccess(await access.grades.readScope())
    expect((await grades.list({ $orderBy: [{ field: 'id', direction: 'asc' }] })).map(row => row.id)).toEqual(['1-math', '2-french', '3-other'])
    expect(await grades.count()).toBe(3)
    expect(await grades.findById('4-foreign')).toBeUndefined()
    const exams = repositories.assessments.forAccess(await access.scope(Permission.EXAM_CONFIG_READ, 'assessments'))
    expect((await exams.list()).map(row => row.id).sort()).toEqual(['assessment-math', 'assessment-other'])
    expect(await exams.findById('assessment-french')).toBeUndefined()
    await db.exec('UPDATE staff_permission_assignments SET ends_at = \'2000-01-01\' WHERE id = \'grades\'')
    await expect(access.grades.readScope()).rejects.toThrow()
  })

  test('removes verified assignment copies while retaining identical manual grants and assignments', async () => {
    await db.exec(`INSERT INTO staff_assignments (id, staff_id, academic_year_id, role, permissions, class_group_id, created_at)
      VALUES ('assignment', 'staff-a', 'year-a', 'Supervision', '["GRADE_INPUT"]', 'class-a', now())`)
    await grant('derived', 'GRADE_INPUT', 'class-a', 'assignment')
    await grant('manual', 'GRADE_INPUT', 'class-a')
    await migrate()
    expect((await db.query('SELECT id FROM staff_permission_assignments')).rows).toEqual([{ id: 'manual' }])
    expect((await db.query('SELECT id FROM staff_assignments')).rows).toEqual([{ id: 'assignment' }])
  })

  test.each([
    ['GRADE_INPUT', 'class-b'],
    ['GRADE_INPUT', 'class-old'],
    ['GRADE_INPUT', 'missing'],
    ['GRADE_INPUT', ''],
    ['EXAM_CONFIG_CREATE', 'class-a:math-other'],
    ['EXAM_CONFIG_CREATE', '*:math-a'],
    ['EXAM_CONFIG_CREATE', 'class-a'],
    ['PAYMENT_RECORD', '*'],
    ['QUERY_STUDENT_DETAIL_READ', 'student-a'],
    ['UNKNOWN', 'class-a'],
  ])('rejects ambiguous or invalid %s scope %s and rolls the whole migration back', async (permission, path) => {
    await grant('valid', 'GRADE_READ', 'class-a')
    await grant('invalid', permission, path)
    await expect(migrate()).rejects.toThrow()
    expect((await db.query('SELECT id, scope_ids FROM staff_permission_assignments ORDER BY id')).rows).toHaveLength(2)
    const columns = await db.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'staff_permission_assignments\' AND column_name = \'scopes\'')
    expect(columns.rows).toHaveLength(0)
  })

  test('rejects orphaned derived provenance instead of silently deleting a possible manual grant', async () => {
    await grant('orphan', 'GRADE_INPUT', 'class-a', 'missing-assignment')
    await expect(migrate()).rejects.toThrow('no matching authoritative assignment')
  })

  test('rejects copied grants whose independently changed scope would be lost', async () => {
    await db.exec(`INSERT INTO staff_assignments (id, staff_id, academic_year_id, role, permissions, class_group_id, created_at)
      VALUES ('assignment', 'staff-a', 'year-a', 'Supervision', '["GRADE_INPUT"]', 'class-a', now())`)
    await grant('changed', 'GRADE_INPUT', 'class-other', 'assignment')
    await expect(migrate()).rejects.toThrow('differs from its assignment')
  })
})
