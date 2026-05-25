import type { Student } from '../entities/students/student'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StudentRepository extends BaseRepositoryInterface<Student> {
  listBySchool: (schoolId: string) => Promise<Student[]>
}
