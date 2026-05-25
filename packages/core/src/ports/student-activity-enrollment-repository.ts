import type { StudentActivityEnrollment } from '../entities/students/student-activity-enrollment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface StudentActivityEnrollmentRepository extends BaseRepositoryInterface<StudentActivityEnrollment> {
  findByActivityAndStudent: (
    activityId: string,
    studentId: string,
  ) => Promise<StudentActivityEnrollment | undefined>
  listByActivity: (activityId: string) => Promise<StudentActivityEnrollment[]>
  listByStudent: (studentId: string) => Promise<StudentActivityEnrollment[]>
}
