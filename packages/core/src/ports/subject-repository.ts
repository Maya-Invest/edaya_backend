import type { Subject } from '../entities/academics/subject'
import type { BaseRepositoryInterface } from './_base-repository'

export interface SubjectRepository extends BaseRepositoryInterface<Subject> {
  listBySchool: (schoolId: string) => Promise<Subject[]>
}
