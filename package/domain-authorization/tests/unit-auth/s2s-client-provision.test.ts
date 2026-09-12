import type { S2sClient } from '@edaya/core'
import {
  ActorAssuranceLevel,
  createPlatformActorMetadata,
  createS2sClient,
  listS2sClients,
  revokeS2sClient,
  rotateS2sClientKey,
  S2S_API_KEY_PREFIX,
} from '@edaya/authorization'
import { ALL_PLATFORM_PERMISSIONS } from '@edaya/core'
import { describe, expect, mock, test } from 'bun:test'

const now = new Date('2026-09-01T00:00:00Z')

function platformActor() {
  return createPlatformActorMetadata({
    subjectId: 'subject-op',
    actorId: 'platform-op',
    requestId: 'test',
    authenticatedAt: now,
    assuranceLevel: ActorAssuranceLevel.Verified,
    permissions: ALL_PLATFORM_PERMISSIONS,
    email: 'op@edaya.test',
  })
}

function createS2sRepository() {
  const clients: S2sClient[] = []
  return {
    clients,
    repository: {
      findById: mock(async (id: string) => clients.find(client => client.id === id)),
      findActiveByHash: mock(async (keyHash: string, at = new Date()) =>
        clients.find(client => client.keyHash === keyHash && client.isActive(at))),
      findActiveBySchoolAndClientId: mock(async (schoolId: string, clientId: string, at = new Date()) =>
        clients.find(client => client.schoolId === schoolId && client.clientId === clientId && client.isActive(at))),
      list: mock(async (filter?: { schoolId?: string }) =>
        filter?.schoolId ? clients.filter(client => client.schoolId === filter.schoolId) : clients),
      save: mock(async (client: S2sClient) => {
        const index = clients.findIndex(entry => entry.id === client.id)
        if (index >= 0) {
          clients[index] = client
        }
        else {
          clients.push(client)
        }
        return client
      }),
    },
  }
}

describe('s2s client provision', () => {
  test('mints, lists, rotates, and revokes a per-school key', async () => {
    const { repository } = createS2sRepository()
    const created = await createS2sClient(repository as never, platformActor(), {
      schoolId: 'school-1',
      clientId: 'children-ai',
      accessClass: 'read',
    })

    expect(created.apiKey.startsWith(S2S_API_KEY_PREFIX)).toBe(true)
    expect(created.client.schoolId).toBe('school-1')
    expect(created.client.accessClass).toBe('read')

    const listed = await listS2sClients(repository as never, platformActor(), 'school-1')
    expect(listed).toHaveLength(1)

    const rotated = await rotateS2sClientKey(repository as never, platformActor(), created.client.id)
    expect(rotated.apiKey).not.toBe(created.apiKey)
    expect(rotated.client.keyHash).not.toBe(created.client.keyHash)

    const revoked = await revokeS2sClient(repository as never, platformActor(), created.client.id)
    expect(revoked.isActive()).toBe(false)
    await expect(rotateS2sClientKey(repository as never, platformActor(), created.client.id))
      .rejects
      .toMatchObject({ code: 'S2S_CLIENT_NOT_FOUND' })
  })

  test('rejects a second active client with the same school and clientId', async () => {
    const { repository } = createS2sRepository()
    await createS2sClient(repository as never, platformActor(), {
      schoolId: 'school-1',
      clientId: 'children-ai',
      accessClass: 'write',
      apiKey: `${S2S_API_KEY_PREFIX}fixed-s2s-key-16xx`,
    })
    await expect(createS2sClient(repository as never, platformActor(), {
      schoolId: 'school-1',
      clientId: 'children-ai',
      accessClass: 'read',
    })).rejects.toMatchObject({ code: 'S2S_CLIENT_ID_CONFLICT' })
  })
})
