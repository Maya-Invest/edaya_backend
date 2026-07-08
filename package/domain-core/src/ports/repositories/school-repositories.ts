import type { CoreEntityMap } from '../../registry/core-entity-map'
import type { BaseRepositoryInterface } from './base-repository'

export type CoreEntityRepositories = {
  readonly [Key in keyof CoreEntityMap]: BaseRepositoryInterface<CoreEntityMap[Key]>
}
