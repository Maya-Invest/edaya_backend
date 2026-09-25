import { Permission, validatePermissionScopes } from '@edaya/core'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { describe, expect, test } from 'bun:test'
import { buildDevAccessSeedRecords } from './build-dev-access-seed-records'

describe('buildDevAccessSeedRecords — demo-ci leadership scopes', () => {
  test('director preset supplies explicit, valid typed scopes for each action', () => {
    const context = resolveDevSeedContext()
    const { staffRoleAssignmentRecords } = buildDevAccessSeedRecords(context)
    const director = staffRoleAssignmentRecords.find(assignment => assignment.staffId === 'ci-st5')

    const selections = Object.entries(director?.scopesByPermission ?? {})
    expect(selections.length).toBeGreaterThan(0)
    for (const [permission, scopes] of selections) {
      expect(() => validatePermissionScopes(permission as Permission, scopes)).not.toThrow()
      expect(scopes.every(scope => scope.kind === 'class_group' || scope.kind === 'class_subject')).toBe(true)
    }
    expect(director?.scopesByPermission?.[Permission.QUERY_TIMETABLE_READ]?.length).toBeGreaterThan(0)
  })
})
