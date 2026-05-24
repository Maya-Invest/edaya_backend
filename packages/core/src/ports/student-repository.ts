import type { Student } from '$lib/core/entities/students/student'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StudentRepository extends BaseRepositoryInterface<Student> {
  listBySchool: (schoolId: string) => Promise<Student[]>
}
