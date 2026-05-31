import type { BaseRepositoryInterface } from '../../../src/ports/base-repository'
import type { ActorMetadata } from '../../../src/services/authorization/actor-metadata'
import { describe, expect, mock, test } from 'bun:test'
import { AuthorizedReadService } from '../../../src/services/queries/query-services'

describe('AuthorizedReadService', () => {
  const mockRepo = {
    findById: mock(async (id: string) => ({ id, name: 'Test' })),
    findOne: mock(async () => ({ id: '1', name: 'Test' })),
    list: mock(async () => [{ id: '1', name: 'Test' }]),
    count: mock(async () => 5),
    save: mock(),
    saveAll: mock(),
    delete: mock(),
  } as unknown as BaseRepositoryInterface<any>

  const mockCheckModule = mock(async () => {})
  const mockCheckAccess = mock(async () => {})

  const actor: ActorMetadata = {
    kind: 'system',
    systemId: 'user1',
    schoolId: 'school1',
    requestId: 'req1',
    reason: 'test',
  }

  const service = new AuthorizedReadService<any>(mockRepo, actor, mockCheckModule, mockCheckAccess)

  test('findById checks permission and returns entity', async () => {
    const result = await service.findById('1')
    expect(mockCheckAccess).toHaveBeenCalledWith(actor, ['1'])
    expect(mockRepo.findById).toHaveBeenCalledWith('1')
    expect(result).toEqual({ id: '1', name: 'Test' })
  })

  test('list checks permission and returns entities', async () => {
    const result = await service.list({ limit: 10 })
    expect(mockCheckModule).toHaveBeenCalledWith(actor)
    expect(mockCheckAccess).toHaveBeenCalledWith(actor, ['1'])
    expect(mockRepo.list).toHaveBeenCalledWith({ limit: 10 })
    expect(result).toEqual([{ id: '1', name: 'Test' }])
  })

  test('count checks permission and returns count', async () => {
    const result = await service.count({ name: 'Test' })
    expect(mockCheckModule).toHaveBeenCalledWith(actor)
    expect(mockRepo.count).toHaveBeenCalledWith({ name: 'Test' })
    expect(result).toBe(5)
  })
})
