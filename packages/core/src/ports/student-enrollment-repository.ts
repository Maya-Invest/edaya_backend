import type { StudentEnrollment } from '$lib/core/entities/administration/student-enrollment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StudentEnrollmentRepository extends BaseRepositoryInterface<StudentEnrollment> {
  findCurrentByStudent: (studentId: string) => Promise<StudentEnrollment | undefined>
  listByStudent: (studentId: string) => Promise<StudentEnrollment[]>
  listByClassroom: (classroomId: string) => Promise<StudentEnrollment[]>
}
