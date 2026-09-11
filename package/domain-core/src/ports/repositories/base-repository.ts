export type FieldFilter<V>
  = | V
    | ({
      $eq?: V
      $ne?: V
      $in?: V[]
      $nin?: V[]
      $exists?: boolean
    } & (NonNullable<V> extends number | string | Date
      ? {
          $gt?: V
          $gte?: V
          $lt?: V
          $lte?: V
        }
      : unknown))

export type Filter<T> = {
  [K in keyof T]?: FieldFilter<T[K]>
} & {
  $and?: Filter<T>[]
  $or?: Filter<T>[]
  $not?: Filter<T>
}

export interface SortOption<T> {
  field: keyof T
  direction: 'asc' | 'desc'
}

export type QueryOptions<T> = Filter<T> & {
  $orderBy?: SortOption<T>[]
  $limit?: number
  $offset?: number
}

export interface BaseRepositoryInterface<T> {
  /** Bind trusted school context independently of caller filters. Adapters must scope every operation. */
  forSchool?: (schoolId: string) => BaseRepositoryInterface<T>
  findById: (id: string) => Promise<T | undefined>
  findOne: (options?: QueryOptions<T>, last?: boolean) => Promise<T | undefined>
  findByIds: (ids: readonly string[]) => Promise<T[]>
  list: (options?: QueryOptions<T>) => Promise<T[]>

  count: (filter?: Filter<T>) => Promise<number>

  save: (entity: T) => Promise<void>
  delete: (id: string) => Promise<void>
  batchSave: (entities: T[]) => Promise<string[]>
  batchDelete: (ids: string[]) => Promise<void>
}
