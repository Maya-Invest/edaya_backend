import { describe, expect, test } from 'bun:test'
import { parseScopeIds, serializeScopeIds } from '../../../src/capabilities/authorization/scope/scope-ids-parse'
import { validateScopeIds } from '../../../src/capabilities/authorization/scope/scope-ids-validate'
import { scopePathCovers } from '../../../src/capabilities/authorization/scope/scope-path-covers'

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

  test('wildcard grant covers descendants', () => {
    expect(scopePathCovers('cg-1:*', 'cg-1:cs-1', 'class_subject')).toBe(true)
  })

  test('leaf id matches class subject grant path', () => {
    expect(scopePathCovers('cg-1:cs-1', 'cs-1', 'class_subject')).toBe(true)
  })
})
