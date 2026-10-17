import {
  ActorAssuranceLevel,
  AuthorizationError,
  bootstrapPlatformUserIfAbsent,
  createPlatformActorMetadata,
  createPlatformUser,
  deactivatePlatformUser,
  PLATFORM_BOOTSTRAP_SUBJECT_ID,
} from '@edaya/authorization'
import { ALL_PLATFORM_PERMISSIONS, Permission, PlatformUser } from '@edaya/core'
import { describe, expect, mock, test } from 'bun:test'

const now = new Date('2026-09-01T00:00:00Z')
const atomic = { execute: async <T>(operation: () => Promise<T>) => operation() }

function platformActor() {
  return createPlatformActorMetadata({
    subjectId: 'subject-op',
    actorId: 'platform-op',
    requestId: 'test',
    authenticatedAt: now,
    assuranceLevel: ActorAssuranceLevel.Verified,
    email: 'op@edaya.test',
  })
}

function createPlatformUserRepository() {
  const users: PlatformUser[] = []
  return {
    users,
    repository: {
      findById: mock(async (id: string) => users.find(user => user.id === id)),
      findBySubjectId: mock(async (subjectId: string) => users.find(user => user.subjectId === subjectId)),
      findByEmail: mock(async (email: string) => users.find(user => user.email === email.trim().toLowerCase())),
      list: mock(async () => users),
      save: mock(async (user: PlatformUser) => {
        const index = users.findIndex(entry => entry.id === user.id)
        if (index >= 0) {
          users[index] = user
        }
        else {
          users.push(user)
        }
        return user
      }),
    },
  }
}

describe('platform user provision', () => {
  test.each([false, undefined, null])('never bootstraps with verification %s', async (emailVerified) => {
    const { repository, users } = createPlatformUserRepository()
    const result = await bootstrapPlatformUserIfAbsent(repository as never, {
      subjectId: 'unverified',
      email: 'op@edaya.test',
      emailVerified: emailVerified as boolean,
    })
    expect(result).toBeUndefined()
    expect(users).toHaveLength(0)
    expect(repository.save).not.toHaveBeenCalled()
  })

  test('bootstraps an active operator once and does not resurrect inactive rows', async () => {
    const { repository, users } = createPlatformUserRepository()
    const created = await bootstrapPlatformUserIfAbsent(repository as never, {
      subjectId: 'sub-1',
      email: 'Op@Edaya.test',
      emailVerified: true,
    })

    expect(created?.email).toBe('op@edaya.test')
    expect(created?.createdBySubjectId).toBe(PLATFORM_BOOTSTRAP_SUBJECT_ID)
    expect(created?.permissions).toEqual([...ALL_PLATFORM_PERMISSIONS])
    expect(users).toHaveLength(1)

    const again = await bootstrapPlatformUserIfAbsent(repository as never, {
      subjectId: 'sub-1',
      email: 'op@edaya.test',
      emailVerified: true,
    })
    expect(again?.id).toBe(created?.id)
    expect(users).toHaveLength(1)

    users[0] = new PlatformUser({ ...users[0]!.data, isActive: false })
    const resurrected = await bootstrapPlatformUserIfAbsent(repository as never, {
      subjectId: 'sub-1',
      email: 'op@edaya.test',
      emailVerified: true,
    })
    expect(resurrected).toBeUndefined()
    expect(users[0]?.isActive).toBe(false)
  })

  test('defaults created permissions to a subset of the caller', async () => {
    const { repository, users } = createPlatformUserRepository()
    users.push(new PlatformUser({ id: 'platform-op', subjectId: 'subject-op', email: 'op@edaya.test', permissions: [Permission.PLATFORM_USER_READ, Permission.PLATFORM_USER_MANAGE], isActive: true, createdBySubjectId: 'bootstrap' }))
    const limited = platformActor()
    const created = await createPlatformUser(repository as never, limited, {
      subjectId: 'sub-2',
      email: 'second@edaya.test',
    }, atomic)
    expect(created.permissions).toEqual([
      Permission.PLATFORM_USER_READ,
      Permission.PLATFORM_USER_MANAGE,
    ])
  })

  test('rejects self-deactivation', async () => {
    const { repository, users } = createPlatformUserRepository()
    users.push(new PlatformUser({
      id: 'platform-op',
      subjectId: 'subject-op',
      email: 'op@edaya.test',
      permissions: [...ALL_PLATFORM_PERMISSIONS],
      isActive: true,
      createdBySubjectId: PLATFORM_BOOTSTRAP_SUBJECT_ID,
    }))

    await expect(deactivatePlatformUser(repository as never, platformActor(), 'platform-op', atomic))
      .rejects
      .toMatchObject({ code: 'PLATFORM_USER_SELF_DEACTIVATE' })
  })

  test('denies create when the caller lacks PLATFORM_USER_MANAGE', async () => {
    const { repository, users } = createPlatformUserRepository()
    users.push(new PlatformUser({ id: 'platform-op', subjectId: 'subject-op', email: 'op@edaya.test', permissions: [Permission.PLATFORM_USER_READ], isActive: true, createdBySubjectId: 'bootstrap' }))
    await expect(createPlatformUser(
      repository as never,
      platformActor(),
      { subjectId: 'sub-3', email: 'third@edaya.test' },
      atomic,
    )).rejects.toBeInstanceOf(AuthorizationError)
  })
})
