import { permissionRowsFromPreset } from '@edaya/authorization'
import { Permission } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('permission presets', () => {
  test('materializes only selected scoped actions and school-wide permissions', () => {
    const rows = permissionRowsFromPreset('staff', 'school', 'year', [Permission.GRADE_MANAGE, Permission.GRADE_READ, Permission.FINANCIAL_REPORT_READ], {
      [Permission.GRADE_MANAGE]: [{ kind: 'class_group', classGroupId: 'class' }],
    })
    expect(rows).toEqual([
      { staffId: 'staff', schoolId: 'school', academicYearId: 'year', permission: Permission.GRADE_MANAGE, scopes: [{ kind: 'class_group', classGroupId: 'class' }], status: 'active' },
      { staffId: 'staff', schoolId: 'school', academicYearId: 'year', permission: Permission.FINANCIAL_REPORT_READ, scopes: [{ kind: 'school' }], status: 'active' },
    ])
  })
  test('never copies one action’s placement to another and rejects invalid selections', () => {
    expect(permissionRowsFromPreset('staff', 'school', 'year', [Permission.GRADE_READ], {
      [Permission.GRADE_MANAGE]: [{ kind: 'class_group', classGroupId: 'class' }],
    })).toEqual([])
    expect(() => permissionRowsFromPreset('staff', 'school', 'year', [Permission.GRADE_MANAGE], {
      [Permission.GRADE_MANAGE]: [{ kind: 'school' }],
    })).toThrow()
  })
})
