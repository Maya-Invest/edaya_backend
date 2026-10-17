import type { GrantScope } from '@edaya/core'
import { grantScopeContains, grantScopesEquivalent, grantScopesSchema, Permission, validatePermissionScopes } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('typed staff grant scopes', () => {
  const scopes: GrantScope[] = [
    { kind: 'school' },
    { kind: 'all', grain: 'class_subject' },
    { kind: 'grade_level', gradeLevelId: 'level' },
    { kind: 'grade_level_subject', gradeLevelId: 'level' },
    { kind: 'grade_level_subject', gradeLevelId: 'level', gradeLevelSubjectId: 'subject' },
    { kind: 'class_group', classGroupId: 'class' },
    { kind: 'class_subject', classGroupId: 'class' },
    { kind: 'class_subject', classGroupId: 'class', classSubjectId: 'subject' },
    { kind: 'activity', activityId: 'activity' },
    { kind: 'activity', classGroupId: 'class' },
    { kind: 'activity', activityId: 'activity', classGroupId: 'class' },
    { kind: 'student', studentId: 'student' },
  ]

  test.each(scopes)('round-trips the %j selection without a path representation', (scope) => {
    expect(grantScopesSchema.parse(JSON.parse(JSON.stringify([scope])))).toEqual([scope])
  })

  test.each([
    [],
    [{ kind: 'activity' }],
    [{ kind: 'all' }],
    [{ kind: 'class_subject', classSubjectId: 'subject' }],
    [{ kind: 'student', studentId: '' }],
    [{ kind: 'class_group', classGroupId: 'class', unknown: true }],
    [{ kind: 'school' }, { kind: 'student', studentId: 'student' }],
    [{ kind: 'student', studentId: 'student' }, { kind: 'student', studentId: 'student' }],
  ].map(invalid => ({ invalid })))('rejects an ambiguous or malformed selection: %j', ({ invalid }) => {
    expect(grantScopesSchema.safeParse(invalid).success).toBe(false)
  })

  test('explicit all stays within its grain and never becomes school authority', () => {
    expect(grantScopeContains({ kind: 'all', grain: 'class_group' }, { kind: 'class_group', classGroupId: 'any' })).toBe(true)
    expect(grantScopeContains({ kind: 'all', grain: 'class_group' }, { kind: 'school' })).toBe(false)
    expect(grantScopeContains({ kind: 'all', grain: 'class_group' }, { kind: 'class_subject', classGroupId: 'any' })).toBe(false)
  })

  test('subject containment preserves the parent and does not broaden specific selections', () => {
    const allSubjects: GrantScope = { kind: 'class_subject', classGroupId: 'a' }
    const subject: GrantScope = { ...allSubjects, classSubjectId: 'math' }
    expect(grantScopeContains(allSubjects, subject)).toBe(true)
    expect(grantScopeContains(subject, allSubjects)).toBe(false)
    expect(grantScopeContains(allSubjects, { kind: 'class_subject', classGroupId: 'b', classSubjectId: 'math' })).toBe(false)
    expect(grantScopeContains({ kind: 'activity', activityId: 'club', classGroupId: 'a' }, { kind: 'activity', activityId: 'club' })).toBe(false)
  })

  test('each action admits only its catalog grain; platform actions cannot be staff grants', () => {
    expect(() => validatePermissionScopes(Permission.GRADE_MANAGE, [{ kind: 'class_group', classGroupId: 'class' }])).not.toThrow()
    expect(() => validatePermissionScopes(Permission.GRADE_MANAGE, [{ kind: 'school' }])).toThrow()
    expect(() => validatePermissionScopes(Permission.GRADE_MANAGE, [{ kind: 'student', studentId: 'student' }])).toThrow()
    expect(() => validatePermissionScopes(Permission.PAYMENT_RECORD, [{ kind: 'all', grain: 'student' }])).not.toThrow()
    expect(() => validatePermissionScopes(Permission.PLATFORM_USER_MANAGE, [{ kind: 'school' }])).toThrow()
  })

  test('equivalent scopes ignore order', () => {
    expect(grantScopesEquivalent(
      [{ kind: 'class_group', classGroupId: 'a' }, { kind: 'class_group', classGroupId: 'b' }],
      [{ kind: 'class_group', classGroupId: 'b' }, { kind: 'class_group', classGroupId: 'a' }],
    )).toBe(true)
    expect(grantScopesEquivalent(
      [{ kind: 'class_group', classGroupId: 'a' }],
      [{ kind: 'class_group', classGroupId: 'b' }],
    )).toBe(false)
  })
})
