import type { HttpSeedClient } from '../../http/client'
import type { CoreHttpRequestOptions } from '../../http/core-entity'
import type { ReportCardsSeedPort } from './port'
import { postCoreCommand } from '../../http/core-entity'
import { withSeedPortError } from '../../support/seed-port-error'

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
    publishReportCardResult: record =>
      withSeedPortError('reportCards.publishReportCardResult', async () => {
        await postCoreCommand(requestOptions, 'publishReportCardResult', record)
      }),
  }
}
