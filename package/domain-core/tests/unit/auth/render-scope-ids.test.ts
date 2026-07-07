import { describe, expect, test } from 'bun:test'
import { Permission } from '../../../src/capabilities/authorization'
import { renderScopeIds } from '../../../src/capabilities/authorization/scope/render-scope-ids'

describe('renderScopeIds', () => {
  test('returns tenant-wide result for empty scopeIds', async () => {
    const rendered = await renderScopeIds('', {
      resolveLabel: async () => 'School',
    })

    expect(rendered).toEqual({
      scopeIds: '',
      permission: undefined,
      tenantWide: true,
      clauses: [],
    })
  })

  test('returns non-tenant-wide empty result for scoped permission with empty scopeIds', async () => {
    const rendered = await renderScopeIds('', {
      permission: Permission.GRADE_INPUT,
      resolveLabel: async () => undefined,
    })

    expect(rendered.tenantWide).toBe(false)
    expect(rendered.clauses).toEqual([])
    expect(rendered.permission).toBe(Permission.GRADE_INPUT)
  })

  test('renders class group labels and marks missing entities', async () => {
    const rendered = await renderScopeIds('cg-1,cg-2', {
      permission: Permission.GRADE_INPUT,
      resolveLabel: async (_scope, entityId) => (
        entityId === 'cg-1' ? 'Grade 6A' : undefined
      ),
    })

    expect(rendered.clauses).toHaveLength(1)
    expect(rendered.clauses[0]?.label).toBe('Grade 6A, cg-2')
    expect(rendered.clauses[0]?.segments).toEqual([
      { id: 'cg-1', scope: 'class_group', label: 'Grade 6A' },
      { id: 'cg-2', scope: 'class_group', label: 'cg-2', missing: true },
    ])
  })

  test('renders wildcard paths for descendant scope grants', async () => {
    const rendered = await renderScopeIds('cg-1:*', {
      permission: Permission.GRADE_INPUT,
      resolveLabel: async () => 'Grade 6A',
    })

    expect(rendered.clauses[0]?.wildcard).toBe(true)
    expect(rendered.clauses[0]?.segments).toEqual([
      { id: 'cg-1', scope: 'class_group', label: 'Grade 6A' },
    ])
  })

  test('renders nested paths under class group scoped permissions', async () => {
    const rendered = await renderScopeIds('cg-1:cs-1', {
      permission: Permission.GRADE_INPUT,
      resolveLabel: async (scope, entityId) => `${scope}:${entityId}`,
    })

    expect(rendered.clauses[0]?.segments).toEqual([
      { id: 'cg-1', scope: 'class_group', label: 'class_group:cg-1' },
      { id: 'cs-1', scope: 'class_group', label: 'class_group:cs-1' },
    ])
  })
})
