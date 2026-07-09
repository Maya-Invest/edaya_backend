import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { ReportCardsSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand } from '../../../transport/http/core-entity'

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
    createGradeScale: record => withSeedPortError('reportCards.createGradeScale', async () => {
      await postCoreCommand(requestOptions, 'createGradeScale', record)
    }),
    createReportCardDefinition: record =>
      withSeedPortError('reportCards.createReportCardDefinition', async () => {
        await postCoreCommand(requestOptions, 'createReportCardDefinition', record)
      }),
    createReportCardSection: record => withSeedPortError('reportCards.createReportCardSection', async () => {
      await postCoreCommand(requestOptions, 'createReportCardDefinitionSection', record)
    }),
    generateReportCardResult: record =>
      withSeedPortError('reportCards.generateReportCardResult', async () => {
        await postCoreCommand(requestOptions, 'generateReportCardResult', record)
      }),
    saveReportCardTeacherComment: record =>
      withSeedPortError('reportCards.saveReportCardTeacherComment', async () => {
        await postCoreCommand(requestOptions, 'writeHomeroomReportComment', {
          id: record.id,
          teacherComment: record.teacherComment,
        })
      }),
    publishReportCardResult: record =>
      withSeedPortError('reportCards.publishReportCardResult', async () => {
        await postCoreCommand(requestOptions, 'publishReportCardResult', record)
      }),
  }
}
