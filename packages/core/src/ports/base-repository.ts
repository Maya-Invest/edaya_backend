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

export interface BaseRepositoryInterface<T> {
  findById: (id: string) => Promise<T | undefined>
  list: (filter?: Filter<T>) => Promise<T[]>
  save: (entity: T) => Promise<void>
  delete: (entity: T) => Promise<void>
  count: (filter?: Filter<T>) => Promise<number>
}
