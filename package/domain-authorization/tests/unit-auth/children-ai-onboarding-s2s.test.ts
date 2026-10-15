import type { S2sClient } from '@edaya/core'
import {
  CHILDREN_AI_S2S_CLIENT_ID,
  encodeS2sApiKey,
  localChildrenAiS2sApiKey,
  provisionChildrenAiReadS2sClient,
} from '@edaya/authorization'
import { describe, expect, mock, test } from 'bun:test'

function createS2sRepository() {
  const clients: S2sClient[] = []
  return {
    clients,
    repository: {
      findById: mock(async (id: string) => clients.find(client => client.id === id)),
      findActiveByHash: mock(async (keyHash: string, at = new Date()) =>
        clients.find(client => client.keyHash === keyHash && client.isActive(at))),
      findActiveBySchoolAndClientId: mock(async (schoolId: string, clientId: string, at = new Date()) =>
        clients.find(client =>
          client.schoolId === schoolId && client.clientId === clientId && client.isActive(at))),
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

describe('children-ai onboarding S2S', () => {
  test('mints a deterministic local key from schoolId', async () => {
    const schoolId = '550e8400-e29b-41d4-a716-446655440000'
    const expected = 's2s_live_local_550e8400e29b41d4a716446655440000_children_ai01'
    expect(localChildrenAiS2sApiKey(schoolId)).toBe(expected)

    const { repository } = createS2sRepository()
    const created = await provisionChildrenAiReadS2sClient(repository as never, {
      schoolId,
      createdBySubjectId: 'owner-1',
      keyMode: 'deterministic',
    })

    expect(created.created).toBe(true)
    expect(created.apiKey).toBe(expected)
    expect(created.client.clientId).toBe(CHILDREN_AI_S2S_CLIENT_ID)
    expect(created.client.accessClass).toBe('read')
    expect(created.client.keyHash).toBe(encodeS2sApiKey(expected).hash)
  })

  test('is idempotent when a children-ai client already exists', async () => {
    const { repository } = createS2sRepository()
    const first = await provisionChildrenAiReadS2sClient(repository as never, {
      schoolId: 'school-1',
      createdBySubjectId: 'owner-1',
      keyMode: 'deterministic',
    })
    const second = await provisionChildrenAiReadS2sClient(repository as never, {
      schoolId: 'school-1',
      createdBySubjectId: 'owner-1',
      keyMode: 'random',
    })
    expect(second.created).toBe(false)
    expect(second.client.id).toBe(first.client.id)
    expect(second.apiKey).toBeUndefined()
  })
})
