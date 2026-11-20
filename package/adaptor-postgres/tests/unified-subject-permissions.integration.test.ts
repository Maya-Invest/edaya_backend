import type { GrantScope } from '@edaya/core'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AccessFacts, AccessPolicies, assertGrantDelegation, createStaffActorMetadata, validateGrantTargets } from '@edaya/authorization'
import { Permission, StaffPermissionAssignment } from '@edaya/core'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase, migrationDirectory, seedAuthorizationRelationships } from './support/authorization-database'

const actor = createStaffActorMetadata({ schoolId: 'school-a', staffMemberId: 'staff-a', subjectId: 'person-a', academicYearId: 'year-a', requestId: 'unified-subject', authenticatedAt: new Date() })
const subject: Extract<GrantScope, { kind: 'subject' }> = { kind: 'subject', gradeLevelId: 'level-a', subjectId: 'math' }

describe('unified Subject authority', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    await seedAuthorizationRelationships(fixture.db)
  })
  afterEach(async () => {
    await fixture.db.close()
  })
  async function grant(scopes: GrantScope[]) {
    await fixture.repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'unified', schoolId: 'school-a', staffId: 'staff-a', academicYearId: 'year-a', permission: Permission.ASSESSMENT_READ, scopes }))
  }
  async function visible() {
    const access = new AccessPolicies(actor, fixture.repositories)
    return (await fixture.repositories.assessments.forAccess(await access.scope(Permission.ASSESSMENT_READ, 'assessments')).list()).map(row => row.id).sort()
  }
  test('Subject-wide scope reaches future matching classes while a restriction stays in its class', async () => {
    await fixture.db.exec(`
      INSERT INTO grade_levels (id, school_id, name, short_name, order_val, created_at) VALUES ('level-other', 'school-a', 'Other', 'Other', 2, now());
      INSERT INTO subjects (id, school_id, grade_level_id, academic_year_id, name, short_name, category_id, created_at) VALUES ('math-other-grade', 'school-a', 'level-other', 'year-a', 'Math', 'Math', 'category-a', now());
      INSERT INTO class_groups (id, school_id, grade_level_id, name, short_name, academic_year_id, created_at) VALUES ('other-grade', 'school-a', 'level-other', 'Other', 'Other', 'year-a', now());
      INSERT INTO class_subjects (id, class_group_id, subject_id, created_at, completed_percentage) VALUES ('offering-other-grade', 'other-grade', 'math-other-grade', now(), 0);
      INSERT INTO assessments (id, class_group_id, class_subject_id, period_id, title, kind, max_score, coefficient, due_at, created_at) VALUES ('assessment-other-grade', 'other-grade', 'offering-other-grade', 'period-a', 'Math', 'homework', 20, 1, '2026-05-01', now());
    `)
    await grant([subject])
    expect(await visible()).toEqual(['assessment-math', 'assessment-other'])
    await fixture.db.exec(`
      INSERT INTO class_groups (id, school_id, grade_level_id, name, short_name, academic_year_id, created_at) VALUES ('future', 'school-a', 'level-a', 'Future', 'Future', 'year-a', now());
      INSERT INTO class_subjects (id, class_group_id, subject_id, created_at, completed_percentage) VALUES ('math-future', 'future', 'math', now(), 0);
      INSERT INTO assessments (id, class_group_id, class_subject_id, period_id, title, kind, max_score, coefficient, due_at, created_at) VALUES ('assessment-future', 'future', 'math-future', 'period-a', 'Math', 'homework', 20, 1, '2026-05-01', now());
    `)
    expect(await visible()).toEqual(['assessment-future', 'assessment-math', 'assessment-other'])
    await grant([{ ...subject, classGroupId: 'class-a' }])
    expect(await visible()).toEqual(['assessment-math'])
    await grant([{ kind: 'subject', gradeLevelId: 'level-a', classGroupId: 'class-a' }])
    expect(await visible()).toEqual(['assessment-french', 'assessment-math'])
  })
  test('delegation cannot remove a restriction or change grade, school or year', async () => {
    const restricted: GrantScope = { ...subject, classGroupId: 'class-a' }
    await grant([restricted])
    const requested = { permission: Permission.ASSESSMENT_READ, academicYearId: 'year-a', scopes: [restricted] }
    const facts = () => new AccessFacts(actor, fixture.repositories)
    await assertGrantDelegation(facts(), [requested])
    for (const scope of [subject, { ...subject, classGroupId: 'class-other' }, { kind: 'subject' as const, gradeLevelId: 'level-a', classGroupId: 'class-a' }, { kind: 'all' as const, grain: 'subject' as const }])
      await expect(assertGrantDelegation(facts(), [{ ...requested, scopes: [scope] }])).rejects.toThrow()
    for (const scope of [{ ...subject, classGroupId: 'class-b' }, { ...subject, classGroupId: 'class-old' }, { ...subject, subjectId: 'foreign-math' }, { ...subject, gradeLevelId: 'level-b' }])
      await expect(validateGrantTargets(facts(), { ...requested, scopes: [scope] })).rejects.toThrow()
    await expect(validateGrantTargets(facts(), { ...requested, academicYearId: 'year-old', scopes: [subject] })).rejects.toThrow()
    await grant([subject])
    await assertGrantDelegation(facts(), [requested])
  })
  test('cutover rejects obsolete grants without deleting academic or teaching data', async () => {
    const migration = readFileSync(resolve(migrationDirectory, '0045_unified_subject_permissions.sql'), 'utf8')
    await grant([subject])
    for (const obsolete of [[{ kind: 'class_subject', classGroupId: 'class-a' }], [{ kind: 'all', grain: 'class_subject' }]]) {
      await fixture.db.query('UPDATE staff_permission_assignments SET scopes = $1 WHERE id = $2', [JSON.stringify(obsolete), 'unified'])
      await expect(fixture.db.exec(migration)).rejects.toThrow('explicit permission reset')
      expect((await fixture.db.query('SELECT id FROM subjects')).rows.length).toBe(3)
      expect((await fixture.db.query('SELECT id FROM teacher_assignments')).rows.length).toBe(1)
      expect((await fixture.db.query('SELECT scopes FROM staff_permission_assignments WHERE id = $1', ['unified'])).rows[0]).toEqual({ scopes: obsolete })
    }
    await grant([subject])
    await fixture.db.exec(migration)
  })
})

test('preflight checks defaults, manual assignments and profile bindings as well as resolved grants', async () => {
  const db = new PGlite()
  const tables = [['staff_permission_assignments', 'scopes'], ['staff_permission_scope_defaults', 'scopes'], ['staff_manual_permission_assignments', 'custom_scopes'], ['staff_permission_profile_bindings', 'custom_scopes']]
  const migration = readFileSync(resolve(migrationDirectory, '0045_unified_subject_permissions.sql'), 'utf8')
  try {
    for (const [table, column] of tables) await db.exec(`CREATE TABLE ${table} (${column} jsonb)`)
    for (const [table, column] of tables) {
      for (const obsolete of [{ kind: 'class_subject', classGroupId: 'class' }, { kind: 'all', grain: 'class_subject' }]) {
        await db.query(`INSERT INTO ${table} (${column}) VALUES ($1)`, [JSON.stringify([obsolete])])
        await expect(db.exec(migration)).rejects.toThrow('explicit permission reset')
        expect((await db.query(`SELECT * FROM ${table}`)).rows).toHaveLength(1)
        await db.exec(`DELETE FROM ${table}`)
      }
    }
    await db.exec(migration)
  }
  finally { await db.close() }
})
