import type { Deadline } from '$lib/core/entities/assessments/deadline'
import type { BaseRepositoryInterface } from './_base-repository'

export interface DeadlineRepository extends BaseRepositoryInterface<Deadline> {
  listBySchool: (schoolId: string) => Promise<Deadline[]>
  listByClassGroup: (classGroupId: string) => Promise<Deadline[]>
  listByClassSubject: (classSubjectId: string) => Promise<Deadline[]>
}
