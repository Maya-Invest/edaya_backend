import type {
  AccessSeedPort,
  StaffAssignmentSeedRecord,
  StaffPermissionAssignmentSeedRecord,
} from './port'
import { demoDataset } from '@edaya/fixtures'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { describe, expect, test } from 'bun:test'
import {
  runDevAccessAssignmentsSeedWithPort,
  runDevAccessRolesSeedWithPort,
  runDevAccessSeedWithPort,
} from '../../orchestration/run-dev-access-seed'

/* eslint-disable-next-line dot-notation -- process.env index signature */
process.env['SEED_DATASET'] = 'demo'

function createMemoryPort(schoolExists = true): {
  port: AccessSeedPort
  permissionAssignments: StaffPermissionAssignmentSeedRecord[]
  staffAssignments: StaffAssignmentSeedRecord[]
} {
  const permissionAssignments: StaffPermissionAssignmentSeedRecord[] = []
  const staffAssignments: StaffAssignmentSeedRecord[] = []

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
