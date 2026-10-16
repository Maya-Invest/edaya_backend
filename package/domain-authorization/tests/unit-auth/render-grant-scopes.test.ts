import { AccessFacts, ActorAssuranceLevel, createStaffActorMetadata, renderGrantScopes, renderScopeSelections } from '@edaya/authorization'
import { Permission } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase } from '../../../adaptor-postgres/tests/support/authorization-database'

describe('typed grant scope labels', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
  })
  afterEach(async () => {
    await fixture.db.close()
  })
  function facts() {
    return new AccessFacts(createStaffActorMetadata({ schoolId: 'school-a', staffMemberId: 'staff-a', subjectId: 'person-a', requestId: 'labels', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified }), fixture.repositories)
  }

  test('labels typed class and subject selections and explicitly marks stale targets', async () => {
    const scopes = await renderGrantScopes(facts(), { academicYearId: 'year-a', permission: Permission.EXAM_CONFIG_CREATE, scopes: [
      { kind: 'class_subject', classGroupId: 'class-a', classSubjectId: 'math-a' },
      { kind: 'class_subject', classGroupId: 'class-a' },
      { kind: 'class_subject', classGroupId: 'missing' },
    ] })
    expect(scopes.map(row => [row.label, row.missing])).toEqual([['A / Math', false], ['A / All subjects', false], ['Unavailable resource', true]])
  })

  test('foreign, wrong-year and mismatched-parent targets do not disclose resource labels', async () => {
    const scopes = await renderGrantScopes(facts(), { academicYearId: 'year-a', permission: Permission.EXAM_CONFIG_CREATE, scopes: [
      { kind: 'class_subject', classGroupId: 'class-b', classSubjectId: 'math-b' },
      { kind: 'class_subject', classGroupId: 'class-old' },
      { kind: 'class_subject', classGroupId: 'class-a', classSubjectId: 'math-other' },
    ] })
    expect(scopes.every(scope => scope.missing && scope.label === 'Unavailable resource')).toBe(true)
  })

  test('school and explicit all labels remain distinct, and wrong-grain requests fail', async () => {
    expect((await renderGrantScopes(facts(), { academicYearId: 'year-a', permission: Permission.STAFF_READ, scopes: [{ kind: 'school' }] }))[0]?.label).toBe('School')
    expect((await renderGrantScopes(facts(), { academicYearId: 'year-a', permission: Permission.GRADE_READ, scopes: [{ kind: 'all', grain: 'class_group' }] }))[0]?.label).toBe('All class group resources')
    await expect(renderGrantScopes(facts(), { academicYearId: 'year-a', permission: Permission.GRADE_READ, scopes: [{ kind: 'school' }] })).rejects.toThrow()
    await expect(renderGrantScopes(facts(), { academicYearId: 'year-b', permission: Permission.STAFF_READ, scopes: [{ kind: 'school' }] })).rejects.toThrow()
  })

  test('default selections render mixed grains, school and unused selections without a permission', async () => {
    const scopes = await renderScopeSelections(facts(), { academicYearId: 'year-a', scopes: [
      { kind: 'school' },
      { kind: 'all', grain: 'student' },
      { kind: 'grade_level', gradeLevelId: 'level-a' },
      { kind: 'grade_level_subject', gradeLevelId: 'level-a' },
      { kind: 'class_group', classGroupId: 'class-a' },
      { kind: 'activity', classGroupId: 'class-a' },
    ] })
    expect(scopes.map(row => row.label)).toEqual(['School', 'All student resources', 'A', 'A / All subjects', 'A', 'A / All activities'])
    expect(scopes.every(row => !row.missing)).toBe(true)
    expect(await renderScopeSelections(facts(), { academicYearId: 'year-a', scopes: [] })).toEqual([])
  })

  test('default selection labels do not disclose foreign, stale or mismatched targets', async () => {
    const scopes = await renderScopeSelections(facts(), { academicYearId: 'year-a', scopes: [
      { kind: 'grade_level', gradeLevelId: 'level-b' },
      { kind: 'class_group', classGroupId: 'class-old' },
      { kind: 'class_subject', classGroupId: 'class-a', classSubjectId: 'math-other' },
      { kind: 'activity', activityId: 'deleted' },
      { kind: 'student', studentId: 'deleted' },
    ] })
    expect(scopes.every(row => row.missing && row.label === 'Unavailable resource')).toBe(true)
    await expect(renderScopeSelections(facts(), { academicYearId: 'year-b', scopes: [] })).rejects.toThrow()
  })
})
