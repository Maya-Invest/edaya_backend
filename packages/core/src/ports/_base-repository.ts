export interface BaseRepositoryInterface<T> {
  findById: (id: string) => Promise<T | undefined>
  list: (filter?: object) => Promise<T[]>
  save: (entity: T) => Promise<void>
  delete: (entity: T) => Promise<void>
  count: (filter?: object) => Promise<number>
}
