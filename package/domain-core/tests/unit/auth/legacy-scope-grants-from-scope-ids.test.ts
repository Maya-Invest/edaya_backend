import { describe, expect, test } from 'bun:test'
import { legacyScopeGrantsFromScopeIdsByPermission, Permission } from '../../../src/capabilities/authorization'

describe('legacyScopeGrantsFromScopeIdsByPermission', () => {
  test('maps portal student paths to legacy student scope grants', () => {
    const grants = legacyScopeGrantsFromScopeIdsByPermission({
      [Permission.QUERY_STUDENT_DETAIL_READ]: 's1,s2',
    })

    expect(grants).toEqual([{
      permission: Permission.QUERY_STUDENT_DETAIL_READ,
      scopeType: 'student',
      scopeEntityIds: ['s1', 's2'],
    }])
  })

  test('maps class group paths to legacy class_group scope grants', () => {
    const grants = legacyScopeGrantsFromScopeIdsByPermission({
      [Permission.GRADE_READ]: '6a,5a',
    })

    expect(grants).toEqual([{
      permission: Permission.GRADE_READ,
      scopeType: 'class_group',
      scopeEntityIds: ['6a', '5a'],
    }])
  })

  test('maps class subject paths to course_assignment and wildcard class groups', () => {
    const grants = legacyScopeGrantsFromScopeIdsByPermission({
      [Permission.GRADE_INPUT]: '6a:cs-math;5a:*',
    })

    expect(grants).toEqual([
      {
        permission: Permission.GRADE_INPUT,
        scopeType: 'course_assignment',
        scopeEntityIds: ['cs-math'],
      },
      {
        permission: Permission.GRADE_INPUT,
        scopeType: 'class_group',
        scopeEntityIds: ['5a'],
      },
    ])
  })

  test('skips tenant-wide empty scopeIds', () => {
    expect(legacyScopeGrantsFromScopeIdsByPermission({
      [Permission.STUDENT_READ]: '',
    })).toEqual([])
  })
})
