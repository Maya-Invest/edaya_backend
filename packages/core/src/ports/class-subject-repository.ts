import type { ClassSubject } from '../entities/academics/class-subject'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ClassSubjectRepository extends BaseRepositoryInterface<ClassSubject> {
  listByClassGroup: (classGroupId: string) => Promise<ClassSubject[]>
  listBySubject: (subjectId: string) => Promise<ClassSubject[]>
}
