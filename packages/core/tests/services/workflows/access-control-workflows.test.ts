import type {
  BusinessRuleViolationError,
} from '../../../src'
import type { AuthorizationPolicy, EffectiveGrants } from '../../../src/authorization'
import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  createStaffActorMetadata,
  Guardian,
  Permission,
  StaffMember,
  Student,
  StudentStatus,
} from '../../../src'
import { SchoolService } from '../../../src/services'

function actorWithPermissions(permissions: readonly Permission[]) {
  const effectiveGrants: EffectiveGrants = {
    permissions: new Set(permissions),
    scopeGrants: permissions.map(permission => ({
      permission,
      scopeType: 'school',
      scopeEntityIds: ['sch1'],
    })),
    isElevated: false,
  }

  return createStaffActorMetadata({
    subjectId: 'admin-subject',
    staffMemberId: 'staff-admin',
    schoolId: 'sch1',
    requestId: 'req-1',
    authenticatedAt: new Date('2026-01-01T00:00:00Z'),
    assuranceLevel: ActorAssuranceLevel.Strong,
    effectiveGrants,
  })
}

function createAccessControlContext(actor = actorWithPermissions([Permission.ACCESS_CONTROL_ASSIGN])) {
  const staffMember = new StaffMember({
    id: 'st1',
    schoolId: 'sch1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@school.edu',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  })

  const guardian = new Guardian({
    id: 'g1',
    schoolId: 'sch1',
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@mail.com',
    phone: '+33 6 00 00 00 00',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  })

  const student = new Student({
    id: 's1',
    schoolId: 'sch1',
    firstName: 'Alan',
    lastName: 'Turing',
    status: StudentStatus.Active,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  })

  const mockRepos = {
    schools: {
      findById: mock(async (id: string) => id === 'sch1' ? { id: 'sch1', ownerStaffId: undefined } : undefined),
    },
    staffMembers: {
      findById: mock(async (id: string) => id === 'st1' ? staffMember : undefined),
      findOne: mock(async () => undefined),
      save: mock(async () => {}),
    },
    guardians: {
      findById: mock(async (id: string) => id === 'g1' ? guardian : undefined),
      findOne: mock(async () => undefined),
      save: mock(async () => {}),
    },
    students: {
      findById: mock(async (id: string) => id === 's1' ? student : undefined),
      findOne: mock(async () => undefined),
      save: mock(async () => {}),
    },
  } as unknown as SchoolRepositories

  const mockPolicy = {} as AuthorizationPolicy
  const service = new SchoolService({
    repositories: mockRepos,
    authorizationPolicy: mockPolicy,
    actor,
    atomicExecution: {
      execute: async operation => operation(),
    },
  })

  return { mockRepos, service, staffMember, guardian, student }
}

describe('SchoolService access-control workflows', () => {
  test('linkActorSubject links a staff member when caller has ACCESS_CONTROL_ASSIGN', async () => {
    const { mockRepos, service } = createAccessControlContext()

    const result = await service.linkActorSubject({
      subjectId: 'auth-user-1',
      staffMemberId: 'st1',
    })

    expect(result.kind).toBe('staff')
    expect(result.entity.subjectId).toBe('auth-user-1')
    expect(mockRepos.staffMembers.save).toHaveBeenCalled()
  })

  test('linkActorSubject rejects callers without ACCESS_CONTROL_ASSIGN', async () => {
    const { service } = createAccessControlContext(
      actorWithPermissions([Permission.ACCESS_CONTROL_READ]),
    )

    await expect(service.linkActorSubject({
      subjectId: 'auth-user-1',
      staffMemberId: 'st1',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('linkActorSubject rejects ambiguous targets', async () => {
    const { service } = createAccessControlContext()

    await expect(service.linkActorSubject({
      subjectId: 'auth-user-1',
      staffMemberId: 'st1',
      guardianId: 'g1',
    })).rejects.toMatchObject({
      code: 'LINK_ACTOR_SUBJECT_AMBIGUOUS',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('linkActorSubject rejects subject ids already linked elsewhere', async () => {
    const { mockRepos, service } = createAccessControlContext()
    mockRepos.guardians.findOne = mock(async () => new Guardian({
      id: 'g-other',
      schoolId: 'sch1',
      firstName: 'Other',
      lastName: 'Guardian',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))

    await expect(service.linkActorSubject({
      subjectId: 'auth-user-1',
      staffMemberId: 'st1',
    })).rejects.toMatchObject({
      code: 'SUBJECT_ID_ALREADY_LINKED',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('linkActorSubject is idempotent when the same subject is already linked', async () => {
    const { mockRepos, service } = createAccessControlContext()
    mockRepos.staffMembers.findById = mock(async () => new StaffMember({
      id: 'st1',
      schoolId: 'sch1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      subjectId: 'auth-user-1',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))

    const result = await service.linkActorSubject({
      subjectId: 'auth-user-1',
      staffMemberId: 'st1',
    })

    expect(result.entity.subjectId).toBe('auth-user-1')
    expect(mockRepos.staffMembers.save).toHaveBeenCalled()
  })
})
