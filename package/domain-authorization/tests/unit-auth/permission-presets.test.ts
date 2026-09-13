import { permissionRowsFromPreset } from '@edaya/authorization'
import { Permission } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('permission presets', () => {
  test('materializes only selected scoped actions and school-wide permissions', () => {
    const rows = permissionRowsFromPreset('staff', 'school', 'year', [Permission.GRADE_INPUT, Permission.GRADE_READ, Permission.PAYMENT_READ], {
      [Permission.GRADE_INPUT]: [{ kind: 'class_group', classGroupId: 'class' }],
    })
    expect(rows).toEqual([
      { staffId: 'staff', schoolId: 'school', academicYearId: 'year', permission: Permission.GRADE_INPUT, scopes: [{ kind: 'class_group', classGroupId: 'class' }], status: 'active' },
      { staffId: 'staff', schoolId: 'school', academicYearId: 'year', permission: Permission.PAYMENT_READ, scopes: [{ kind: 'school' }], status: 'active' },
    ])
  })
  test('never copies one action’s placement to another and rejects invalid selections', () => {
    expect(permissionRowsFromPreset('staff', 'school', 'year', [Permission.GRADE_READ], {
      [Permission.GRADE_INPUT]: [{ kind: 'class_group', classGroupId: 'class' }],
    })).toEqual([])
    expect(() => permissionRowsFromPreset('staff', 'school', 'year', [Permission.GRADE_INPUT], {
      [Permission.GRADE_INPUT]: [{ kind: 'school' }],
    })).toThrow()
  })
})
