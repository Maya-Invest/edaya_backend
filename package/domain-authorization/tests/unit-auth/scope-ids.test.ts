import { Permission, scopeGrantCovers } from '@edaya/authorization'
import { describe, expect, test } from 'bun:test'
import { mergeScopeGrants } from '../../src/grants/scope-grant-covers'
import { parseScopeIds, serializeScopeIds } from '../../src/scope/scope-ids-parse'
import { validateScopeIds } from '../../src/scope/scope-ids-validate'
import { scopePathCovers } from '../../src/scope/scope-path-covers'

describe('parseScopeIds', () => {
  test('parses empty tenant-wide grant', () => {
    expect(parseScopeIds('')).toEqual({ clauses: [] })
  })

  test('parses multi-root and multi-clause grants', () => {
    const parsed = parseScopeIds('cg-1,cg-2;cg-3:cs-1')
    expect(parsed.clauses).toHaveLength(2)
    expect(parsed.clauses[0]?.paths).toHaveLength(2)
    expect(parsed.clauses[1]?.paths[0]?.segments).toEqual(['cg-3', 'cs-1'])
  })

  test('round-trips through serializeScopeIds', () => {
    const input = 'cg-1:*;cg-2,cs-3'
    expect(serializeScopeIds(parseScopeIds(input))).toBe(input)
  })
})

describe('validateScopeIds', () => {
  test('allows empty scopeIds for tenant-wide permissions', () => {
    expect(() => validateScopeIds('', undefined)).not.toThrow()
  })

  test('rejects empty scopeIds for scoped permissions', () => {
    expect(() => validateScopeIds('', 'class_group')).toThrow()
  })

  test('rejects non-empty scopeIds for tenant-wide permissions', () => {
    expect(() => validateScopeIds('cg-1', undefined)).toThrow()
  })
})

describe('scopePathCovers', () => {
  test('tenant-wide grant covers any resource when scope omitted', () => {
    expect(scopePathCovers('', 'cg-1', undefined)).toBe(true)
  })

  test('class group grant covers matching class', () => {
    expect(scopePathCovers('cg-1', 'cg-1', 'class_group')).toBe(true)
    expect(scopePathCovers('cg-1', 'cg-2', 'class_group')).toBe(false)
  })

  test('scoped grant does not cover empty resource path', () => {
    expect(scopePathCovers('cg-1', '', 'class_group')).toBe(false)
  })

  test('wildcard grant covers descendants', () => {
    expect(scopePathCovers('cg-1:*', 'cg-1:cs-1', 'class_subject')).toBe(true)
  })

  test('leaf id matches class subject grant path', () => {
    expect(scopePathCovers('cg-1:cs-1', 'cs-1', 'class_subject')).toBe(true)
  })
})

describe('scopeGrantCovers tenant-wide paths', () => {
  test('tenant-wide scopeIds do not cover scoped resource checks', () => {
    const grants = {
      permissions: new Set([Permission.PAYMENT_READ]),
      scopeGrants: [],
      scopeIdsByPermission: { [Permission.PAYMENT_READ]: '' },
      isElevated: false,
    }

    expect(scopeGrantCovers(grants, {
      permission: Permission.PAYMENT_READ,
      schoolId: 'school-1',
      scopeType: 'school',
      scopeEntityId: 'school-1',
      isElevated: false,
    })).toBe(true)

    expect(scopeGrantCovers(grants, {
      permission: Permission.PAYMENT_READ,
      schoolId: 'school-1',
      scopeType: 'student',
      scopeEntityId: 'student-1',
      isElevated: false,
    })).toBe(false)
  })

  test('scoped scopeIds do not satisfy school-wide resource checks', () => {
    const grants = {
      permissions: new Set([Permission.GRADE_READ]),
      scopeGrants: [],
      scopeIdsByPermission: { [Permission.GRADE_READ]: 'class-1' },
      isElevated: false,
    }

    expect(scopeGrantCovers(grants, {
      permission: Permission.GRADE_READ,
      schoolId: 'school-1',
      scopeType: 'school',
      scopeEntityId: 'school-1',
      isElevated: false,
    })).toBe(false)
  })
})

describe('mergeScopeGrants', () => {
  test('merges duplicate permission and scope type rows', () => {
    expect(mergeScopeGrants([
      { permission: Permission.GRADE_INPUT, scopeType: 'class_group', scopeEntityIds: ['cg-1'] },
      { permission: Permission.GRADE_INPUT, scopeType: 'class_group', scopeEntityIds: ['cg-2'] },
    ])).toEqual([{
      permission: Permission.GRADE_INPUT,
      scopeType: 'class_group',
      scopeEntityIds: ['cg-1', 'cg-2'],
    }])
  })
})

describe('scopeGrantCovers legacy scope grants', () => {
  test('matches school-wide legacy scope grants', () => {
    expect(scopeGrantCovers([
      { permission: Permission.STUDENT_READ, scopeType: 'school', scopeEntityIds: ['school-1'] },
    ], {
      permission: Permission.STUDENT_READ,
      schoolId: 'school-1',
      scopeType: 'class_group',
      scopeEntityId: 'class-1',
      isElevated: false,
    })).toBe(true)
  })

  test('matches explicit class group entity id on legacy grants', () => {
    expect(scopeGrantCovers([
      { permission: Permission.GRADE_INPUT, scopeType: 'class_group', scopeEntityIds: ['class-1'] },
    ], {
      permission: Permission.GRADE_INPUT,
      schoolId: 'school-1',
      scopeType: 'class_group',
      scopeEntityId: 'class-1',
      isElevated: false,
    })).toBe(true)
  })
})
