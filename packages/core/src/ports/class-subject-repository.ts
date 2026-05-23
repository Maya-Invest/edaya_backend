import type { ClassSubject } from '$lib/core/entities/academics/class-subject'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ClassSubjectRepository extends BaseRepositoryInterface<ClassSubject> {
  listByClassGroup: (classGroupId: string) => Promise<ClassSubject[]>
  listBySubject: (subjectId: string) => Promise<ClassSubject[]>
}
