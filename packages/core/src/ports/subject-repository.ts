import type { Subject } from '$lib/core/entities/academics/subject'
import type { BaseRepositoryInterface } from './_base-repository'

export interface SubjectRepository extends BaseRepositoryInterface<Subject> {
  listBySchool: (schoolId: string) => Promise<Subject[]>
}
