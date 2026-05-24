import type { ClassExam } from '$lib/core/entities/assessments/class-exam'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ClassExamRepository extends BaseRepositoryInterface<ClassExam> {
  findByExamAndClassGroupAndPeriod: (
    examId: string,
    classGroupId: string,
    periodId: string,
  ) => Promise<ClassExam | undefined>
  listByExam: (examId: string) => Promise<ClassExam[]>
  listByClassGroupAndPeriod: (classGroupId: string, periodId: string) => Promise<ClassExam[]>
}
