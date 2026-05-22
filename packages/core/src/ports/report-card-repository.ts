import type { ReportCard } from '$lib/core/entities/assessments/report-card'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ReportCardRepository extends BaseRepositoryInterface<ReportCard> {
  findByStudentAndPeriod: (studentId: string, periodId: string) => Promise<ReportCard | undefined>
  listByStudent: (studentId: string) => Promise<ReportCard[]>
}
