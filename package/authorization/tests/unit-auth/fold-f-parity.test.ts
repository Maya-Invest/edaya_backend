import { Permission } from '@edaya/authorization'
import { describe, expect, test } from 'bun:test'
import { ALL_GUARDIAN_CAPABILITIES } from '../../src/capabilities/guardian-capability'
import { ALL_HOMEROOM_CAPABILITIES } from '../../src/capabilities/homeroom-capability'
import { ALL_TEACHING_CAPABILITIES } from '../../src/capabilities/teaching-capability'
import { scopeIdsForStaffAssignmentPermission } from '../../src/sync/staff-assignment-permission-rules'

describe('Fold F auth parity', () => {
  test('staff teaching writes still resolve to class_group scope paths', () => {
    const target = {
      kind: 'class_group' as const,
      schoolId: 'school-1',
      classGroupId: 'cg-6a',
    }

    expect(scopeIdsForStaffAssignmentPermission(Permission.GRADE_INPUT, target)).toBe('cg-6a')
    expect(scopeIdsForStaffAssignmentPermission(Permission.ATTENDANCE_RECORD, target)).toBe('cg-6a')
    expect(scopeIdsForStaffAssignmentPermission(Permission.CLASS_LOGBOOK_CREATE, target)).toBe('cg-6a')
  })

  test('portal actors expose capability catalogs instead of permission grants', () => {
    expect(ALL_GUARDIAN_CAPABILITIES.length).toBeGreaterThan(0)
    expect(ALL_TEACHING_CAPABILITIES.length).toBeGreaterThan(0)
    expect(ALL_HOMEROOM_CAPABILITIES.length).toBeGreaterThan(0)
    expect(ALL_GUARDIAN_CAPABILITIES).not.toContain(Permission.GRADE_INPUT)
  })
})
