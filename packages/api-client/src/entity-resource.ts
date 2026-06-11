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

  list(query: EntityQuery = {}): Promise<TEntity[]> {
    return this.transport.request('POST', this.path('list'), { body: query })
  }

  one(query: EntityQuery): Promise<TEntity> {
    return this.transport.request('POST', this.path('one'), { body: query })
  }

  count(query: EntityQuery = {}): Promise<{ count: number }> {
    return this.transport.request('POST', this.path('count'), { body: query })
  }

  get(id: string): Promise<TEntity> {
    return this.transport.request('GET', `/api/core/entities/${this.publicName}/${id}`)
  }

  save(entity: TEntity): Promise<TEntity> {
    return this.transport.request('POST', this.path('save'), { body: entity })
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
