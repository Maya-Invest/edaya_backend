import type {
  AccessSeedPort,
  ApplyStaffPermissionProfileSeedRecord,
  PermissionProfileSeedRecord,
  StaffAssignmentSeedRecord,
  StaffPermissionAssignmentSeedRecord,
} from './port'
import { Permission } from '@edaya/core'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { describe, expect, test } from 'bun:test'
import {
  runDevAccessAssignmentsSeedWithPort,
  runDevAccessRolesSeedWithPort,
  runDevAccessSeedWithPort,
} from '../../orchestration/run-dev-access-seed'

function createMemoryPort(
  schoolExists = true,
  profiles: readonly PermissionProfileSeedRecord[] = [],
): {
  port: AccessSeedPort
  permissionAssignments: StaffPermissionAssignmentSeedRecord[]
  staffAssignments: StaffAssignmentSeedRecord[]
  profileBindings: ApplyStaffPermissionProfileSeedRecord[]
} {
  const permissionAssignments: StaffPermissionAssignmentSeedRecord[] = []
  const staffAssignments: StaffAssignmentSeedRecord[] = []
  const profileBindings: ApplyStaffPermissionProfileSeedRecord[] = []

  const schoolId = resolveDevSeedContext().schoolId

  return {
    port: {
      schoolExists: async id => schoolExists && id === schoolId,
      saveStaffPermissionAssignment: async (record) => {
        permissionAssignments.push(record)
      },
      saveStaffAssignment: async (record) => {
        staffAssignments.push(record)
      },
      listPermissionProfiles: async () => profiles,
      applyStaffPermissionProfile: async (record) => {
        profileBindings.push(record)
      },
    },
    permissionAssignments,
    staffAssignments,
    profileBindings,
  }
}

describe('access seed port workflow', () => {
  test('seeds declarative access records with accurate result counts', async () => {
    const memory = createMemoryPort()

    const result = await runDevAccessSeedWithPort(memory.port)

    expect(result.status).toBe('seeded')
    if (result.status !== 'seeded') {
      return
    }
    expect(result.permissionAssignments).toBeGreaterThan(0)
    expect(result.staffAssignments).toBe(2)
    expect(memory.permissionAssignments.length).toBe(result.permissionAssignments)
    expect(memory.staffAssignments.filter(assignment => assignment.classSubjectId)).toHaveLength(0)
  })

  test('binds staff to combined permission profiles after grants', async () => {
    const memory = createMemoryPort(true, [
      { id: 'pp-director', sourceKey: 'role-director', permissions: [Permission.STAFF_READ, Permission.GRADE_READ] },
      { id: 'pp-coordinator', sourceKey: 'role-coordinator', permissions: [Permission.STAFF_READ, Permission.GRADE_READ] },
      { id: 'pp-educator', sourceKey: 'role-educator', permissions: [Permission.GRADE_READ] },
    ])

    await runDevAccessAssignmentsSeedWithPort(memory.port)

    expect(memory.profileBindings.filter(binding => binding.staffId === 'ci-st5').map(binding => binding.profileId))
      .toEqual(['pp-director'])
    expect(memory.profileBindings.filter(binding => binding.staffId === 'ci-st8').map(binding => binding.profileId))
      .toEqual(['pp-director'])
    expect(memory.profileBindings.filter(binding => binding.staffId === 'ci-st3').map(binding => binding.profileId))
      .toEqual(['pp-coordinator'])
    expect(memory.profileBindings.filter(binding => binding.staffId === 'ci-st7').map(binding => binding.profileId))
      .toEqual(['pp-educator'])
    expect(memory.profileBindings.find(binding => binding.profileId === 'pp-director')?.customScopes).toEqual([
      { kind: 'all', grain: 'grade_level' },
      { kind: 'all', grain: 'grade_level_subject' },
      { kind: 'all', grain: 'class_group' },
      { kind: 'all', grain: 'class_subject' },
    ])
  })

  test('skips assignments when the school is missing', async () => {
    const memory = createMemoryPort(false)

    await runDevAccessRolesSeedWithPort(memory.port)
    expect(await runDevAccessAssignmentsSeedWithPort(memory.port)).toEqual({
      status: 'skipped',
      reason: 'school-not-seeded',
    })
    expect(memory.permissionAssignments).toHaveLength(0)
    expect(memory.staffAssignments).toHaveLength(0)
  })
})
