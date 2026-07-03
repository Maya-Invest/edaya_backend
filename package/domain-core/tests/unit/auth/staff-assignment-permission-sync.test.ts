import type { StaffPermissionAssignment } from '../../../src/domain/school/staff-permission-assignment'
import { describe, expect, test } from 'bun:test'
import { Permission } from '../../../src/capabilities/authorization'
import {
  resolveStaffAssignmentTarget,
  scopeIdsForStaffAssignmentPermission,
  validateStaffAssignmentPermissionSelection,
} from '../../../src/capabilities/authorization/sync/staff-assignment-permission-rules'
import { syncStaffAssignmentPermissions } from '../../../src/capabilities/authorization/sync/staff-assignment-permission-sync'
import { StaffAssignment } from '../../../src/domain/school/staff-assignment'

function assignment(overrides: Record<string, unknown> = {}) {
  return new StaffAssignment({
    id: 'sa-1',
    staffId: 'staff-1',
    academicYearId: 'year-1',
    responsibility: 'Teacher',
    permissions: [],
    classGroupId: 'cg-1',
    ...overrides,
  })
}

function repositories(overrides: Record<string, unknown> = {}) {
  const permissionRows = new Map<string, StaffPermissionAssignment>()

  return {
    classGroups: {
      findById: async (id: string) => id === 'cg-1'
        ? { id, schoolId: 'school-1', name: '7A' }
        : undefined,
    },
    classSubjects: {
      findById: async (id: string) => id === 'cs-1'
        ? { id, classGroupId: 'cg-1', subjectId: 'sub-1' }
        : undefined,
    },
    lessonSessions: {
      findById: async (id: string) => id === 'ls-1'
        ? { id, schoolId: 'school-1', classGroupId: 'cg-1', classSubjectId: 'cs-1' }
        : undefined,
    },
    activitySessions: {
      findById: async (id: string) => id === 'as-1'
        ? { id, schoolId: 'school-1', classGroupId: 'cg-1', activityId: 'act-1' }
        : undefined,
    },
    assessments: {
      findById: async (id: string) => id === 'exam-1'
        ? { id, classGroupId: 'cg-1', classSubjectId: 'cs-1' }
        : undefined,
    },
    staffPermissionAssignments: {
      list: async (filter?: { sourceStaffAssignmentId?: string }) => {
        if (!filter?.sourceStaffAssignmentId) {
          return [...permissionRows.values()]
        }
        return [...permissionRows.values()].filter(
          row => row.sourceStaffAssignmentId === filter.sourceStaffAssignmentId,
        )
      },
      save: async (row: StaffPermissionAssignment) => {
        permissionRows.set(row.id, row)
      },
      delete: async (id: string) => {
        permissionRows.delete(id)
      },
    },
    ...overrides,
  } as any
}

describe('staff assignment permission rules', () => {
  test('resolves class group scope paths', async () => {
    const target = await resolveStaffAssignmentTarget(assignment(), repositories())
    expect(target.kind).toBe('class_group')
    expect(scopeIdsForStaffAssignmentPermission(Permission.GRADE_READ, target)).toBe('cg-1')
    expect(scopeIdsForStaffAssignmentPermission(Permission.GRADE_INPUT, target)).toBe('cg-1:*')
  })

  test('resolves class subject scope paths', async () => {
    const target = await resolveStaffAssignmentTarget(
      assignment({ classGroupId: undefined, classSubjectId: 'cs-1' }),
      repositories(),
    )
    expect(scopeIdsForStaffAssignmentPermission(Permission.GRADE_INPUT, target)).toBe('cg-1:cs-1')
  })

  test('rejects tenant-wide permissions on assignments', () => {
    expect(() => validateStaffAssignmentPermissionSelection(
      assignment({ permissions: [Permission.STAFF_READ] }),
      { kind: 'class_group', schoolId: 'school-1', classGroupId: 'cg-1' },
    )).toThrow()
  })
})

describe('syncStaffAssignmentPermissions', () => {
  test('creates derived permission rows on save', async () => {
    const repos = repositories()
    await syncStaffAssignmentPermissions(
      assignment({ permissions: [Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD] }),
      repos,
      new Date('2026-01-01T00:00:00Z'),
    )

    const rows = await repos.staffPermissionAssignments.list({ sourceStaffAssignmentId: 'sa-1' })
    expect(rows).toHaveLength(2)
    expect(rows.find((row: StaffPermissionAssignment) => row.permission === Permission.GRADE_INPUT)?.scopeIds).toBe('cg-1:*')
    expect(rows.every((row: StaffPermissionAssignment) => row.sourceStaffAssignmentId === 'sa-1')).toBe(true)
  })

  test('replaces derived rows when permissions change', async () => {
    const repos = repositories()
    await syncStaffAssignmentPermissions(
      assignment({ permissions: [Permission.GRADE_INPUT] }),
      repos,
    )
    await syncStaffAssignmentPermissions(
      assignment({ permissions: [Permission.GRADE_READ] }),
      repos,
    )

    const rows = await repos.staffPermissionAssignments.list({ sourceStaffAssignmentId: 'sa-1' })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.permission).toBe(Permission.GRADE_READ)
  })

  test('removes derived rows when permissions are cleared', async () => {
    const repos = repositories()
    await syncStaffAssignmentPermissions(
      assignment({ permissions: [Permission.GRADE_INPUT] }),
      repos,
    )
    await syncStaffAssignmentPermissions(
      assignment({ permissions: [] }),
      repos,
    )

    const rows = await repos.staffPermissionAssignments.list({ sourceStaffAssignmentId: 'sa-1' })
    expect(rows).toHaveLength(0)
  })
})
