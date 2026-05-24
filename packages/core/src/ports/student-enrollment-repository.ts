import type { StudentClassEnrollment } from '$lib/core/entities/students/student-class-enrollment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StudentClassEnrollmentRepository extends BaseRepositoryInterface<StudentClassEnrollment> {
  findCurrentByStudent: (studentId: string) => Promise<StudentClassEnrollment | undefined>
  listByStudent: (studentId: string) => Promise<StudentClassEnrollment[]>
  listByClassGroup: (classGroupId: string) => Promise<StudentClassEnrollment[]>
}
