import type { SeedApplication } from '../../../support/types'
import type { ReportCardsSeedPort } from '../port'
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
        await service.assessmentsWorkflow.writeHomeroomReportComment({
          id: record.id,
          requestId: `seed-comment:${record.id}`,
          expectedVersion: (await service.baseService.entities.results.findById(record.id))!.version,
          teacherComment: record.teacherComment,
        })
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
