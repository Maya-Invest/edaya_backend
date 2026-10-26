import type { SeedApplication } from '../../../support/types'
import type { ReportCardsSeedPort } from '../port'
import { dispatchGradingRecalculation } from '@edaya/service'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'
import { configureSeedGrading } from '../configure-grading'

export function createInProcessReportCardsSeedPort(
  application: SeedApplication,
): ReportCardsSeedPort {
  const service = createInProcessSeedService(application, 'dev-report-cards-seed')

  return {
    configureGrading: record => withSeedPortError('reportCards.configureGrading', () => configureSeedGrading(record, {
      read: async () => (await application.repositories.gradeLevels.findById(record.gradeLevelId))?.gradingPolicyFor(record.academicYearId),
      configure: async () => {
        await service.assessmentsWorkflow.configureGrading({ ...record, requestId: `seed-grading:${record.gradeLevelId}:${record.academicYearId}`, expectedRevision: 0, confirmed: true })
      },
      advance: () => dispatchGradingRecalculation(application),
    })),
    createGradeScale: record => withSeedPortError('reportCards.createGradeScale', async () => {
      await service.assessmentsWorkflow.createGradeScale({
        ...record,
        ranges: record.ranges.map(range => ({ ...range })),
      })
    }),
    configureReport: record => withSeedPortError('reportCards.configureReport', async () => {
      const level = await application.repositories.gradeLevels.findById(record.gradeLevelId)
      let expectedRevision = level!.reportSettingsFor(record.academicYearId).revision
      const scope = { gradeLevelId: record.gradeLevelId, academicYearId: record.academicYearId }
      await service.assessmentsWorkflow.configureReportSettings({ ...scope, requestId: `seed-report-settings:${record.gradeLevelId}`, expectedRevision, passThreshold: record.passThreshold })
      expectedRevision += 1
      for (const { subjectIds, ...module } of record.modules) {
        await service.assessmentsWorkflow.configureReportModules({ ...scope, requestId: `seed-module:${module.id}`, expectedRevision, action: 'save', module, assignments: subjectIds.map((subjectId, index) => ({ subjectId, moduleId: module.id, order: index + 1 })) })
        expectedRevision += 1
      }
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
        const report = (await service.baseService.entities.results.findById(record.id))!
        await service.assessmentsWorkflow.publishReportCardResult({
          ...record,
          reviewedDraftVersion: report.version,
          reviewedGradingRevision: report.gradingPolicyRevision!,
          reviewedReportConfigurationRevision: report.reportConfigurationRevision,
          publishedAt: record.publishedAt ? new Date(record.publishedAt) : undefined,
        })
      }),
  }
}
