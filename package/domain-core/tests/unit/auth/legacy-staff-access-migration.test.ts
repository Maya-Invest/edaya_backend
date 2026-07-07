import { describe, expect, test } from 'bun:test'
import {
  buildScopeIdsByPermissionFromLegacyAccess,
  expandLegacyStaffAccessToPermissionRows,
  mergePermissionScopeIds,
  Permission,
  permissionRowsFromTemplatePermissions,
  scopeIdsFromLegacyScopeGrant,
} from '../../../src/capabilities/authorization'

describe('legacy staff access migration', () => {
  test('expands role permissions with tenant-wide defaults and explicit scope grants', () => {
    const rows = expandLegacyStaffAccessToPermissionRows({
      accessRoles: [{
        id: 'role-dev-sample',
        permissions: [Permission.GRADE_READ, Permission.GRADE_INPUT, Permission.PAYMENT_READ],
      }],
      roleAssignments: [{
        staffId: 'staff-1',
        schoolId: 'school-1',
        academicYearId: 'year-1',
        roleIds: ['role-dev-sample'],
        scopeGrants: [{
          permission: Permission.GRADE_INPUT,
          scopeType: 'class_group',
          scopeEntityIds: ['class-1'],
        }],
        status: 'active',
      }],
      defaultAcademicYearId: 'year-1',
    })

    expect(rows).toContainEqual(expect.objectContaining({
      permission: Permission.GRADE_INPUT,
      scopeIds: 'class-1',
    }))
    expect(rows).toContainEqual(expect.objectContaining({
      permission: Permission.PAYMENT_READ,
      scopeIds: '',
    }))
    expect(rows.some(row => row.permission === Permission.GRADE_READ)).toBe(false)
  })

  test('merges school and class scope grants without losing class paths', () => {
    const scopeIdsByPermission = buildScopeIdsByPermissionFromLegacyAccess(
      [Permission.ATTENDANCE_RECORD],
      [
        {
          permission: Permission.ATTENDANCE_RECORD,
          scopeType: 'school',
          scopeEntityIds: ['school-1'],
        },
        {
          permission: Permission.ATTENDANCE_RECORD,
          scopeType: 'class_group',
          scopeEntityIds: ['class-1', 'class-2'],
        },
      ],
    )

    expect(scopeIdsByPermission.get(Permission.ATTENDANCE_RECORD)).toBe('class-1,class-2')
  })

  test('scopeIdsFromLegacyScopeGrant returns empty for school-wide grants', () => {
    expect(scopeIdsFromLegacyScopeGrant({
      permission: Permission.GRADE_READ,
      scopeType: 'school',
      scopeEntityIds: ['school-1'],
    })).toBe('')
  })

  test('mergePermissionScopeIds combines distinct scope paths', () => {
    expect(mergePermissionScopeIds('class-1', 'class-2')).toBe('class-1;class-2')
    expect(mergePermissionScopeIds(undefined, '')).toBe('')
    expect(mergePermissionScopeIds('class-1', 'class-1')).toBe('class-1')
  })

  test('permissionRowsFromTemplatePermissions emits scoped rows for template permissions', () => {
    const rows = permissionRowsFromTemplatePermissions(
      'staff-1',
      'school-1',
      'year-1',
      [Permission.GRADE_INPUT, Permission.PAYMENT_READ],
      [{
        permission: Permission.GRADE_INPUT,
        scopeType: 'class_group',
        scopeEntityIds: ['class-1'],
      }],
    )

    expect(rows).toContainEqual(expect.objectContaining({
      permission: Permission.GRADE_INPUT,
      scopeIds: 'class-1',
    }))
    expect(rows).toContainEqual(expect.objectContaining({
      permission: Permission.PAYMENT_READ,
      scopeIds: '',
    }))
  })
})
