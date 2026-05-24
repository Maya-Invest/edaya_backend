import type { Exam } from '$lib/core/entities/assessments/exam'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ExamRepository extends BaseRepositoryInterface<Exam> {
  listBySchool: (schoolId: string) => Promise<Exam[]>
  listByAcademicYear: (academicYearId: string) => Promise<Exam[]>
}
