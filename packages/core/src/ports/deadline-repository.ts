import type { Deadline } from '$lib/core/entities/deadline'
import type { BaseRepositoryInterface } from './_base-repository'

export interface DeadlineRepository extends BaseRepositoryInterface<Deadline> {
  listBySchool: (schoolId: string) => Promise<Deadline[]>
  listByClassroom: (classroomId: string) => Promise<Deadline[]>
  listByModule: (moduleId: string) => Promise<Deadline[]>
}
