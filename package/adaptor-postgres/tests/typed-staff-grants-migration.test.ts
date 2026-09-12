import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { installSchemaBeforeTypedGrants, seedAuthorizationPlacement, typedGrantsMigration } from './support/authorization-database'

describe('typed staff grants coordinated migration', () => {
  let db: PGlite
  beforeEach(async () => {
    db = new PGlite()
    await installSchemaBeforeTypedGrants(db)
    await seedAuthorizationPlacement(db)
  })
  afterEach(async () => { await db.close() })

  async function grant(id: string, permission: string, path: string, source: string | null = null) {
    await db.query(`INSERT INTO staff_permission_assignments
      (id, staff_id, school_id, academic_year_id, permission, scope_ids, source_staff_assignment_id, status, created_at, updated_at)
      VALUES ($1, 'staff-a', 'school-a', 'year-a', $2, $3, $4, 'active', '2026-01-01', '2026-02-01')`, [id, permission, path, source])
  }
  async function migrate() { await db.transaction(async tx => { await tx.exec(typedGrantsMigration) }) }

  test('preserves manual provenance, status, validity, action and class/subject wildcard meaning', async () => {
    await grant('manual', 'GRADE_INPUT', 'class-a;class-other,class-a')
    await grant('subject', 'EXAM_CONFIG_CREATE', 'class-a:math-a,class-other:*')
    await grant('all-classes', 'GRADE_READ', '*')
    await grant('all-subjects', 'EXAM_CONFIG_READ', '*:*')
    await grant('school', 'PAYMENT_RECORD', '')
    await db.exec("UPDATE staff_permission_assignments SET status = 'inactive', starts_at = '2026-03-01', ends_at = '2026-07-01' WHERE id = 'manual'")
    await migrate()
    const { rows } = await db.query<{ id: string, scopes: unknown, status: string, starts_at: Date, ends_at: Date, created_at: Date, updated_at: Date }>('SELECT * FROM staff_permission_assignments ORDER BY id')
    const byId = Object.fromEntries(rows.map(row => [row.id, row]))
    expect(byId['manual']?.scopes).toEqual([{ kind: 'class_group', classGroupId: 'class-a' }, { kind: 'class_group', classGroupId: 'class-other' }])
    expect(byId['manual']?.status).toBe('inactive')
    expect(byId['manual']?.starts_at.toISOString()).toBe('2026-03-01T00:00:00.000Z')
    expect(byId['manual']?.ends_at.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(byId['manual']?.created_at.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(byId['manual']?.updated_at.toISOString()).toBe('2026-02-01T00:00:00.000Z')
    expect(byId['subject']?.scopes).toEqual([{ kind: 'class_subject', classGroupId: 'class-a', classSubjectId: 'math-a' }, { kind: 'class_subject', classGroupId: 'class-other' }])
    expect(byId['all-classes']?.scopes).toEqual([{ kind: 'all', grain: 'class_group' }])
    expect(byId['all-subjects']?.scopes).toEqual([{ kind: 'all', grain: 'class_subject' }])
    expect(byId['school']?.scopes).toEqual([{ kind: 'school' }])
    const columns = await db.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'staff_permission_assignments'")
    expect(columns.rows.map(row => row.column_name)).not.toContain('scope_ids')
    expect(columns.rows.map(row => row.column_name)).not.toContain('source_staff_assignment_id')
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
    ['GRADE_INPUT', 'class-b'], ['GRADE_INPUT', 'class-old'], ['GRADE_INPUT', 'missing'], ['GRADE_INPUT', ''],
    ['EXAM_CONFIG_CREATE', 'class-a:math-other'], ['EXAM_CONFIG_CREATE', '*:math-a'], ['EXAM_CONFIG_CREATE', 'class-a'],
    ['PAYMENT_RECORD', '*'], ['QUERY_STUDENT_DETAIL_READ', 'student-a'], ['UNKNOWN', 'class-a'],
  ])('rejects ambiguous or invalid %s scope %s and rolls the whole migration back', async (permission, path) => {
    await grant('valid', 'GRADE_READ', 'class-a')
    await grant('invalid', permission, path)
    await expect(migrate()).rejects.toThrow()
    expect((await db.query('SELECT id, scope_ids FROM staff_permission_assignments ORDER BY id')).rows).toHaveLength(2)
    const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'staff_permission_assignments' AND column_name = 'scopes'")
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
