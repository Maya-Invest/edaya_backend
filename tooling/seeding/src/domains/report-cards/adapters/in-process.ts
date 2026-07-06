import type { SeedApplication } from '../../../support/types'
import type { ReportCardsSeedPort } from '../port'
import { ReportCardResult } from '@edaya/core'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessReportCardsSeedPort(
  application: SeedApplication,
): ReportCardsSeedPort {
  const service = createInProcessSeedService(application, 'dev-report-cards-seed')

  return {
    createGradeScale: record => withSeedPortError('reportCards.createGradeScale', async () => {
      await service.assessmentsWorkflow.createGradeScale({
        ...record,
        ranges: record.ranges.map(range => ({ ...range })),
      })
    }),
    createReportCardDefinition: record =>
      withSeedPortError('reportCards.createReportCardDefinition', async () => {
        await service.assessmentsWorkflow.createReportCardDefinition(record)
      }),
    createReportCardSection: record => withSeedPortError('reportCards.createReportCardSection', async () => {
      await service.assessmentsWorkflow.createReportCardDefinitionSection(record)
    }),
    generateReportCardResult: record =>
      withSeedPortError('reportCards.generateReportCardResult', async () => {
        await service.assessmentsWorkflow.generateReportCardResult({
          ...record,
          generatedAt: record.generatedAt ? new Date(record.generatedAt) : undefined,
        })
      }),
    saveReportCardTeacherComment: record =>
      withSeedPortError('reportCards.saveReportCardTeacherComment', async () => {
        const existing = await service.entities.results.findById(record.id)
        if (!existing) {
          throw new Error(`Report card result ${record.id} was not found`)
        }
        await service.entities.results.save(new ReportCardResult({
          id: existing.id,
          reportCardDefinitionId: existing.reportCardDefinitionId,
          studentId: existing.studentId,
          classGroupId: existing.classGroupId,
          periodId: existing.periodId,
          sectionResults: [...existing.sectionResults],
          attendanceSummary: existing.attendanceSummary,
          assessmentResultCount: existing.assessmentResultCount,
          overallAverage: existing.overallAverage,
          rank: existing.rank,
          classSize: existing.classSize,
          passThreshold: existing.passThreshold,
          teacherComment: record.teacherComment,
          principalComment: existing.principalComment,
          status: existing.status,
          generatedAt: existing.generatedAt,
          publishedAt: existing.publishedAt,
          aggregation: existing.aggregation,
        }), { moduleChecked: true })
      }),
    publishReportCardResult: record =>
      withSeedPortError('reportCards.publishReportCardResult', async () => {
        await service.assessmentsWorkflow.publishReportCardResult({
          ...record,
          publishedAt: record.publishedAt ? new Date(record.publishedAt) : undefined,
        })
      }),
  }
}
