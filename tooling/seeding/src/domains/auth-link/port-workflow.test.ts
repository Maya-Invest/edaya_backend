import type { AuthProvisioner } from '../../support/types'
import type { AuthLinkSeedPort } from './port'
import { demoSchoolOwnerStaffId } from '@edaya/fixtures'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_STAFF_ACCOUNTS,
  DEV_AUTH_TEACHER_ACCOUNTS,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { describe, expect, test } from 'bun:test'
import { assignDevSchoolOwnerSubjectId, syncDevStaffAuthAndOwner } from '../../bootstrap/dev-staff-auth-seed'

/* eslint-disable-next-line dot-notation -- process.env index signature */
process.env['SEED_DATASET'] = 'demo'

function subjectIdForEmail(email: string): string {
  return `subject:${email}`
}

function createAuthProvisioner(): AuthProvisioner {
  return {
    ensureUser: async account => ({ subjectId: subjectIdForEmail(account.email) }),
    lookupSubjectIdByEmail: async email => subjectIdForEmail(email),
  }
}

function createMemoryPort(): {
  port: AuthLinkSeedPort
  registeredStaff: string[]
  replacedGuardians: string[]
  replacedStaff: string[]
  replacedTeachers: string[]
  state: {
    ownerSubjectId?: string
    guardians: Map<string, string | undefined>
    staff: Map<string, string | undefined>
    teachers: Map<string, string | undefined>
  }
} {
  const firstStaff = DEV_AUTH_STAFF_ACCOUNTS[0]
  const firstGuardian = DEV_AUTH_GUARDIAN_ACCOUNTS[0]
  const firstTeacher = DEV_AUTH_TEACHER_ACCOUNTS[0]
  const state = {
    ownerSubjectId: undefined as string | undefined,
    staff: new Map<string, string | undefined>(
      DEV_AUTH_STAFF_ACCOUNTS.slice(1, -1).map(account => [account.staffId, undefined]),
    ),
    guardians: new Map<string, string | undefined>(
      DEV_AUTH_GUARDIAN_ACCOUNTS.map(account => [account.guardianId, undefined]),
    ),
    teachers: new Map<string, string | undefined>(
      DEV_AUTH_TEACHER_ACCOUNTS.map(account => [account.teacherId, undefined]),
    ),
  }
  if (firstStaff) {
    state.staff.set(firstStaff.staffId, 'stale-staff-subject')
  }
  if (firstGuardian) {
    state.guardians.set(firstGuardian.guardianId, 'stale-guardian-subject')
  }
  if (firstTeacher) {
    state.teachers.set(firstTeacher.teacherId, 'stale-teacher-subject')
  }

  const registeredStaff: string[] = []
  const replacedStaff: string[] = []
  const replacedGuardians: string[] = []
  const replacedTeachers: string[] = []

  const port: AuthLinkSeedPort = {
    findSchoolById: async (id) => {
      const schoolId = resolveDevSeedContext().schoolId
      return id === schoolId
        ? { id, ownerSubjectId: state.ownerSubjectId }
        : undefined
    },
    setSchoolOwnerSubjectId: async (_schoolId, subjectId) => {
      state.ownerSubjectId = subjectId
    },
    findStaffById: async (id) => {
      if (!state.staff.has(id)) {
        return undefined
      }
      return { id, subjectId: state.staff.get(id) }
    },
    registerStaffMember: async (input) => {
      registeredStaff.push(input.id)
      state.staff.set(input.id, undefined)
    },
    replaceStaffSubjectId: async (staffId, subjectId) => {
      replacedStaff.push(staffId)
      state.staff.set(staffId, subjectId)
    },
    findGuardianById: async (id) => {
      if (!state.guardians.has(id)) {
        return undefined
      }
      return { id, subjectId: state.guardians.get(id) }
    },
    findTeacherById: async (id) => {
      if (!state.teachers.has(id)) {
        return undefined
      }
      return { id, subjectId: state.teachers.get(id) }
    },
    replaceGuardianSubjectId: async (guardianId, subjectId) => {
      replacedGuardians.push(guardianId)
      state.guardians.set(guardianId, subjectId)
    },
    replaceTeacherSubjectId: async (teacherId, subjectId) => {
      replacedTeachers.push(teacherId)
      state.teachers.set(teacherId, subjectId)
    },
    linkActorSubject: async (input) => {
      if (input.staffMemberId) {
        state.staff.set(input.staffMemberId, input.subjectId)
      }
      if (input.guardianId) {
        state.guardians.set(input.guardianId, input.subjectId)
      }
      if (input.teacherId) {
        state.teachers.set(input.teacherId, input.subjectId)
      }
    },
  }

  return { port, registeredStaff, replacedGuardians, replacedStaff, replacedTeachers, state }
}

describe('auth-link seed port workflow', () => {
  test('a mismatched persisted owner is reported and left unchanged', async () => {
    const memory = createMemoryPort()
    const owner = DEV_AUTH_STAFF_ACCOUNTS.find(account => account.staffId === demoSchoolOwnerStaffId)
    if (!owner) {
      throw new Error('Dev auth fixtures must include the school owner')
    }
    memory.state.ownerSubjectId = 'persisted-owner'
    memory.state.staff.set(owner.staffId, 'persisted-owner')

    await expect(syncDevStaffAuthAndOwner(memory.port, createAuthProvisioner())).rejects.toThrow(
      'Persisted school owner persisted-owner does not match fixture owner subject:k.yann@school.edu',
    )
    expect(memory.state.ownerSubjectId).toBe('persisted-owner')
    expect(memory.state.staff.get(owner.staffId)).toBe('persisted-owner')
    expect(memory.replacedStaff).not.toContain(owner.staffId)
  })
  test('owner initialization never asks an adapter to replace an existing owner', async () => {
    const memory = createMemoryPort()
    memory.state.ownerSubjectId = 'current-owner'
    await expect(assignDevSchoolOwnerSubjectId(memory.port, 'replacement-owner')).rejects.toThrow('cannot replace the current school owner')
    expect(memory.state.ownerSubjectId).toBe('current-owner')
    await assignDevSchoolOwnerSubjectId(memory.port, 'current-owner')
    expect(memory.state.ownerSubjectId).toBe('current-owner')
  })
  test('registers, links, replaces stale subjects, assigns owner, and stays idempotent', async () => {
    const memory = createMemoryPort()
    const auth = createAuthProvisioner()

    const first = await syncDevStaffAuthAndOwner(memory.port, auth)

    expect(first?.linkedStaff).toBe(DEV_AUTH_STAFF_ACCOUNTS.length)
    expect(first?.linkedTeachers).toBe(DEV_AUTH_TEACHER_ACCOUNTS.length)
    expect(first?.linkedGuardians).toBe(DEV_AUTH_GUARDIAN_ACCOUNTS.length)
    expect(memory.registeredStaff).toHaveLength(1)
    expect(memory.replacedStaff).toEqual([DEV_AUTH_STAFF_ACCOUNTS[0]?.staffId])
    expect(memory.replacedGuardians).toEqual([DEV_AUTH_GUARDIAN_ACCOUNTS[0]?.guardianId])
    expect(memory.replacedTeachers).toEqual([DEV_AUTH_TEACHER_ACCOUNTS[0]?.teacherId])

    const owner = DEV_AUTH_STAFF_ACCOUNTS.find(account => account.staffId === demoSchoolOwnerStaffId)
    expect(memory.state.ownerSubjectId).toBe(owner ? subjectIdForEmail(owner.email) : undefined)

    const second = await syncDevStaffAuthAndOwner(memory.port, auth)
    expect(second?.linkedStaff).toBe(0)
    expect(second?.linkedTeachers).toBe(0)
    expect(second?.linkedGuardians).toBe(0)
  })
})
