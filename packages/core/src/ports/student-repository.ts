import type { Student } from '$lib/core/entities/core/student'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StudentRepository extends BaseRepositoryInterface<Student> {
  listBySchool: (schoolId: string) => Promise<Student[]>
}
