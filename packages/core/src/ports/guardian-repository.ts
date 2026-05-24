import type { Guardian } from '$lib/core/entities/students/guardian'
import type { BaseRepositoryInterface } from './_base-repository'

export interface GuardianRepository extends BaseRepositoryInterface<Guardian> {
  listBySchool: (schoolId: string) => Promise<Guardian[]>
}
