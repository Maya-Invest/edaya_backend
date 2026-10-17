import { corePermissionDefinition, DomainValidationError, Permission, PERMISSION_CATALOG, scopesForPermission, StaffManualPermissionAssignment, StaffPermissionProfile, validatePermissionScopes } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('canonical permission scope catalog', () => {
  test('every current permission has an explicit policy and assignment eligibility', () => {
    expect(Object.keys(PERMISSION_CATALOG)).toHaveLength(90)
    expect(Object.values(PERMISSION_CATALOG).filter(entry => entry.staffAssignable)).toHaveLength(82)
    expect(Object.keys(PERMISSION_CATALOG).sort()).toEqual(Object.values(Permission).sort())
    for (const permission of Object.values(Permission)) {
      const definition = corePermissionDefinition(permission)
      expect(definition.staffAssignable).toBe(['none', 'resources'].includes(definition.scopePolicy.mode))
      if (definition.scopePolicy.mode === 'resources')
        expect(definition.scopePolicy.allowedKinds.length).toBeGreaterThan(0)
    }
  })

  test('unscoped assignments resolve without selections and ignore mixed profile resources', () => {
    expect(corePermissionDefinition(Permission.ACCESS_CONTROL_READ).scopePolicy).toEqual({ mode: 'none' })
    for (const selections of [[], [{ kind: 'class_group' as const, classGroupId: 'class-a' }], [{ kind: 'school' as const }]]) {
      expect(scopesForPermission(Permission.ACCESS_CONTROL_READ, selections)).toEqual([{ kind: 'school' }])
    }
  })

  test('scoped assignments require compatible targets and retain explicit All semantics', () => {
    expect(scopesForPermission(Permission.GRADE_MANAGE, [])).toEqual([])
    expect(scopesForPermission(Permission.GRADE_MANAGE, [{ kind: 'school' }])).toEqual([])
    expect(scopesForPermission(Permission.GRADE_MANAGE, [{ kind: 'student', studentId: 'student' }])).toEqual([])
    expect(scopesForPermission(Permission.GRADE_MANAGE, [
      { kind: 'class_group', classGroupId: 'a' },
      { kind: 'all', grain: 'class_group' },
      { kind: 'class_group', classGroupId: 'a' },
    ])).toEqual([{ kind: 'all', grain: 'class_group' }])
    expect(scopesForPermission(Permission.ASSESSMENT_READ, [{ kind: 'activity', activityId: 'a' }])).toEqual([])
  })

  test.each([Permission.ATTENDANCE_VALIDATE, Permission.CLASS_LOGBOOK_VALIDATE, Permission.DISCIPLINE_VALIDATE, Permission.REPORT_CARD_PUBLISH])('%s never gains automatic review authority', (permission) => {
    expect(corePermissionDefinition(permission).scopePolicy.mode).toBe('resources')
    expect(scopesForPermission(permission, [])).toEqual([])
    expect(scopesForPermission(permission, [{ kind: 'class_group', classGroupId: 'a' }])).toEqual([{ kind: 'class_group', classGroupId: 'a' }])
    expect(scopesForPermission(permission, [{ kind: 'school' }])).toEqual([])
    expect(() => validatePermissionScopes(permission, [{ kind: 'class_subject', classGroupId: 'a' }])).toThrow()
  })

  test('platform and unknown actions cannot turn an empty selection into a staff grant', () => {
    expect(scopesForPermission(Permission.PLATFORM_USER_READ, [])).toEqual([])
    expect(scopesForPermission(Permission.PLATFORM_USER_READ, [{ kind: 'school' }])).toEqual([])
    expect(() => new StaffPermissionProfile({ id: 'p', schoolId: 's', name: 'Invalid', permissions: [Permission.PLATFORM_USER_READ] })).toThrow(DomainValidationError)
    for (const permission of ['UNKNOWN', 'EXAM_CONFIG_READ', 'EXAM_MANAGE', 'constructor', '__proto__'])
      expect(() => scopesForPermission(permission as Permission, [])).toThrow('Unknown permission')
  })

  test('unscoped manual sources normalize defaults and reject resource selections', () => {
    const input = { id: 'manual', schoolId: 'school', staffId: 'staff', academicYearId: 'year', permission: Permission.STAFF_READ, useDefaultScopes: true }
    for (const customScopes of [[]]) {
      const assignment = new StaffManualPermissionAssignment({ ...input, customScopes })
      expect(assignment.customScopes).toEqual([])
      expect(assignment.useDefaultScopes).toBe(false)
    }
    expect(() => new StaffManualPermissionAssignment({ ...input, customScopes: [{ kind: 'class_group', classGroupId: 'class' }] })).toThrow(DomainValidationError)
    expect(() => new StaffManualPermissionAssignment({ ...input, permission: Permission.PLATFORM_USER_READ })).toThrow(DomainValidationError)
  })
})
