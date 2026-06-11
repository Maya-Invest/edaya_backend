import { unwrapEntity, unwrapEntityList } from './entity-envelope.ts'
import type { Transport } from './transport.ts'

export type EntityQuery = Record<string, unknown> & {
  $orderBy?: Array<{ field: string, direction: 'asc' | 'desc' }>
  $limit?: number
  $offset?: number
}

export class EntityResource<TEntity> {
  constructor(
    private readonly transport: Transport,
    private readonly publicName: string,
  ) {}

  async list(query: EntityQuery = {}): Promise<TEntity[]> {
    const result = await this.transport.request<unknown>('POST', this.path('list'), { body: query })
    return unwrapEntityList<TEntity>(result)
  }

  async one(query: EntityQuery): Promise<TEntity> {
    const result = await this.transport.request<unknown>('POST', this.path('one'), { body: query })
    return unwrapEntity<TEntity>(result)
  }

  count(query: EntityQuery = {}): Promise<{ count: number }> {
    return this.transport.request('POST', this.path('count'), { body: query })
  }

  async get(id: string): Promise<TEntity> {
    const result = await this.transport.request<unknown>('GET', `/api/core/entities/${this.publicName}/${id}`)
    return unwrapEntity<TEntity>(result)
  }

  async save(entity: TEntity): Promise<TEntity> {
    const result = await this.transport.request<unknown>('POST', this.path('save'), { body: entity })
    return unwrapEntity<TEntity>(result)
  }

  delete(input: { id: string }): Promise<{ message: string }> {
    return this.transport.request('POST', this.path('delete'), { body: input })
  }

  batchSave(input: { entities: TEntity[] }): Promise<{ ids: string[] }> {
    return this.transport.request('POST', this.path('batch-save'), { body: input })
  }

  batchDelete(input: { ids: string[] }): Promise<{ message: string }> {
    return this.transport.request('POST', this.path('batch-delete'), { body: input })
  }

  private path(action: string): string {
    return `/api/core/entities/${this.publicName}/${action}`
  }
}
