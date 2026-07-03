import type {
  AccessSeedPort,
  StaffAssignmentSeedRecord,
  StaffPermissionAssignmentSeedRecord,
} from './port'
import { demoDataset } from '@edaya/fixtures'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { describe, expect, test } from 'bun:test'
import {
  runDevAccessAssignmentsSeedWithPort,
  runDevAccessRolesSeedWithPort,
  runDevAccessSeedWithPort,
} from '../../orchestration/run-dev-access-seed'

function createMemoryPort(schoolExists = true): {
  port: AccessSeedPort
  permissionAssignments: StaffPermissionAssignmentSeedRecord[]
  staffAssignments: StaffAssignmentSeedRecord[]
} {
  const permissionAssignments: StaffPermissionAssignmentSeedRecord[] = []
  const staffAssignments: StaffAssignmentSeedRecord[] = []

  return {
    port: {
      schoolExists: async schoolId => schoolExists && schoolId === SEED_SCHOOL_ID,
      saveStaffPermissionAssignment: async (record) => {
        permissionAssignments.push(record)
      },
      saveStaffAssignment: async (record) => {
        staffAssignments.push(record)
      },
    },
    permissionAssignments,
    staffAssignments,
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
    expect(result.staffAssignments).toBe(
      5 + (demoDataset.extensions?.classSubjectStaffAssignments?.length ?? 0),
    )
    expect(memory.permissionAssignments.length).toBe(result.permissionAssignments)
    expect(memory.staffAssignments.filter(assignment => assignment.classSubjectId)).toHaveLength(
      demoDataset.extensions?.classSubjectStaffAssignments?.length ?? 0,
    )
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
