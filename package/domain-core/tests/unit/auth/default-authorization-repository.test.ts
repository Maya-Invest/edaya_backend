import { describe, expect, mock, test } from 'bun:test'
import { DefaultAuthorizationRepository } from '../../../src/capabilities/authorization/resolution/default-authorization-repository'
import { resolveActorGrants } from '../../../src/capabilities/authorization/resolution/resolve-actor-grants'

describe('resolveActorGrants', () => {
  test('rejects non-staff actor types', async () => {
    await expect(resolveActorGrants({
      actorId: 'guardian-1',
      actorType: 'guardian',
      schoolId: 'school-1',
      repositories: {} as never,
    })).rejects.toThrow(/staff-only/)
  })
})

describe('DefaultAuthorizationRepository', () => {
  test('resolveEffectiveGrants returns elevated grants for owner service accounts', async () => {
    const repositories = {
      staffMembers: {
        findById: mock(async () => ({
          id: 'staff-1',
          schoolId: 'school-1',
          isActive: true,
          accountKind: 'service',
          serviceElevated: true,
          subjectId: 'subject-1',
        })),
      },
      schools: {
        findById: mock(async () => undefined),
      },
    }

    const repository = new DefaultAuthorizationRepository(repositories as never)
    const grants = await repository.resolveEffectiveGrants({
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
    })

    expect(grants.isElevated).toBe(true)
    expect(grants.permissions.size).toBeGreaterThan(0)
  })

  test('resolveActorGrants delegates to staff grant resolution', async () => {
    const repositories = {
      staffMembers: {
        findById: mock(async () => ({
          id: 'staff-1',
          schoolId: 'school-1',
          isActive: true,
          accountKind: 'service',
          serviceElevated: true,
          subjectId: 'subject-1',
        })),
      },
      schools: {
        findById: mock(async () => undefined),
      },
    }

    const repository = new DefaultAuthorizationRepository(repositories as never)
    const grants = await repository.resolveActorGrants({
      actorId: 'staff-1',
      actorType: 'staff',
      schoolId: 'school-1',
    })

    expect(grants.isElevated).toBe(true)
  })
})
