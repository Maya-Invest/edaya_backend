import type {
  AccessRoleSeedRecord,
  AccessSeedPort,
  StaffAssignmentSeedRecord,
  StaffRoleAssignmentSeedRecord,
} from './port'
import { SEED_CLASS_SUBJECTS, SEED_SCHOOL_ID } from '@edaya/dev-fixtures'
import { describe, expect, test } from 'bun:test'
import {
  runDevAccessAssignmentsSeedWithPort,
  runDevAccessRolesSeedWithPort,
  runDevAccessSeedWithPort,
} from '../../orchestration/run-dev-access-seed'

function createMemoryPort(schoolExists = true): {
  port: AccessSeedPort
  roles: AccessRoleSeedRecord[]
  roleAssignments: StaffRoleAssignmentSeedRecord[]
  staffAssignments: StaffAssignmentSeedRecord[]
} {
  const roles: AccessRoleSeedRecord[] = []
  const roleAssignments: StaffRoleAssignmentSeedRecord[] = []
  const staffAssignments: StaffAssignmentSeedRecord[] = []

  return {
    port: {
      schoolExists: async schoolId => schoolExists && schoolId === SEED_SCHOOL_ID,
      saveAccessRole: async (record) => {
        roles.push(record)
      },
      saveStaffRoleAssignment: async (record) => {
        roleAssignments.push(record)
      },
      saveStaffAssignment: async (record) => {
        staffAssignments.push(record)
      },
    },
    roles,
    roleAssignments,
    staffAssignments,
  }
}

describe('access seed port workflow', () => {
  test('seeds declarative access records with accurate result counts', async () => {
    const memory = createMemoryPort()

    const result = await runDevAccessSeedWithPort(memory.port)

    expect(result).toEqual({
      status: 'seeded',
      roles: 4,
      assignments: 8,
      staffAssignments: 5 + SEED_CLASS_SUBJECTS.length,
    })
    expect(memory.roles.map(role => role.id)).toEqual([
      'role-teacher',
      'role-coordinator',
      'role-educator',
      'role-director',
    ])
    expect(new Set(memory.roleAssignments.map(assignment => assignment.id)).size).toBe(8)
    expect(memory.roleAssignments.find(assignment => assignment.staffId === 'st6')?.scopeGrants).toHaveLength(2)
    expect(memory.staffAssignments.filter(assignment => assignment.classSubjectId)).toHaveLength(SEED_CLASS_SUBJECTS.length)
  })

  test('skips assignments and rejects roles when the school is missing', async () => {
    const memory = createMemoryPort(false)

    await expect(runDevAccessRolesSeedWithPort(memory.port)).rejects.toThrow(
      'Cannot seed access roles before school exists',
    )
    expect(await runDevAccessAssignmentsSeedWithPort(memory.port)).toEqual({
      status: 'skipped',
      reason: 'school-not-seeded',
    })
    expect(memory.roles).toHaveLength(0)
    expect(memory.roleAssignments).toHaveLength(0)
    expect(memory.staffAssignments).toHaveLength(0)
  })
})
