import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { ReportCardsSeedPort } from '../port'
import { GradeLevel } from '@edaya/core'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntityFindById } from '../../../transport/http/core-entity'
import { configureSeedGrading } from '../configure-grading'

export interface CreateHttpReportCardsSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpReportCardsSeedPort(
  options: CreateHttpReportCardsSeedPortOptions,
): ReportCardsSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-report-cards-seed',
  }

  return {
    configureGrading: record => withSeedPortError('reportCards.configureGrading', async () => {
      const configure = async () => {
        await postCoreCommand(requestOptions, 'configureGrading', { ...record, requestId: `seed-grading:${record.gradeLevelId}:${record.academicYearId}`, expectedRevision: 0, confirmed: true })
      }
      await configureSeedGrading(record, {
        read: async () => {
          const level = await postEntityFindById(requestOptions, 'gradeLevels', record.gradeLevelId)
          return level ? new GradeLevel(level as ConstructorParameters<typeof GradeLevel>[0]).gradingPolicyFor(record.academicYearId) : undefined
        },
        configure,
        advance: async () => {
          await Bun.sleep(250)
          // Replaying the same command nudges the next durable page without a new
          // policy revision, including local runtimes without a cron scheduler.
          await configure()
        },
      })
    }),
    createGradeScale: record => withSeedPortError('reportCards.createGradeScale', async () => {
      await postCoreCommand(requestOptions, 'createGradeScale', record)
    }),
    configureReport: record => withSeedPortError('reportCards.configureReport', async () => {
      const level = new GradeLevel(await postEntityFindById(requestOptions, 'gradeLevels', record.gradeLevelId) as ConstructorParameters<typeof GradeLevel>[0])
      let expectedRevision = level!.reportSettingsFor(record.academicYearId).revision
      const scope = { gradeLevelId: record.gradeLevelId, academicYearId: record.academicYearId }
      await postCoreCommand(requestOptions, 'configureReportSettings', { ...scope, requestId: `seed-report-settings:${record.gradeLevelId}`, expectedRevision, passThreshold: record.passThreshold })
      expectedRevision += 1
      for (const { subjectIds, ...module } of record.modules) {
        await postCoreCommand(requestOptions, 'configureReportModules', { ...scope, requestId: `seed-module:${module.id}`, expectedRevision, action: 'save', module, assignments: subjectIds.map((subjectId, index) => ({ subjectId, moduleId: module.id, order: index + 1 })) })
        expectedRevision += 1
      }
    }),
    generateReportCardResult: record =>
      withSeedPortError('reportCards.generateReportCardResult', async () => {
        await postCoreCommand(requestOptions, 'generateReportCardResult', record)
      }),
    saveReportCardTeacherComment: record =>
      withSeedPortError('reportCards.saveReportCardTeacherComment', async () => {
        const report = await postEntityFindById(requestOptions, 'results', record.id) as { version: number }
        await postCoreCommand(requestOptions, 'writeHomeroomReportComment', {
          requestId: `seed-comment:${record.id}`,
          expectedVersion: report.version,
          id: record.id,
          teacherComment: record.teacherComment,
        })
      }),
    publishReportCardResult: record =>
      withSeedPortError('reportCards.publishReportCardResult', async () => {
        const report = await postEntityFindById(requestOptions, 'results', record.id) as { version: number, gradingPolicyRevision: number, reportConfigurationRevision: number }
        await postCoreCommand(requestOptions, 'publishReportCardResult', { ...record, reviewedDraftVersion: report.version, reviewedGradingRevision: report.gradingPolicyRevision, reviewedReportConfigurationRevision: report.reportConfigurationRevision })
      }),
  }
}
