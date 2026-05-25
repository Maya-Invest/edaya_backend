import type { Resource } from '../entities/school/resource'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ResourceRepository extends BaseRepositoryInterface<Resource> {
  listBySchool: (schoolId: string) => Promise<Resource[]>
}
