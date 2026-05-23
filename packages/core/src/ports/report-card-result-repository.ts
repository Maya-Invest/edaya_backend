import type { ReportCardResult } from '$lib/core/entities/assessments/report-card-result'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ReportCardResultRepository extends BaseRepositoryInterface<ReportCardResult> {
  findByStudentAndPeriod: (studentId: string, periodId: string) => Promise<ReportCardResult | undefined>
  findByStudentAndExam: (studentId: string, examId: string) => Promise<ReportCardResult | undefined>
  listByStudent: (studentId: string) => Promise<ReportCardResult[]>
}
