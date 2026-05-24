import type { ExamSubject } from '$lib/core/entities/assessments/exam-subject'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ExamSubjectRepository extends BaseRepositoryInterface<ExamSubject> {
  findByExamAndSubject: (examId: string, subjectId: string) => Promise<ExamSubject | undefined>
  listByExam: (examId: string) => Promise<ExamSubject[]>
}
