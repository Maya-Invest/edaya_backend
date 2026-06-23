import type { HttpSeedClient } from '../http/client'
import type { CoreHttpRequestOptions } from '../http/core-entity'
import type { AssessmentsSeedPort } from './port'
import { postCoreCommand } from '../http/core-entity'
import { withSeedPortError } from '../seed-port-error'

export interface CreateHttpAssessmentsSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpAssessmentsSeedPort(
  options: CreateHttpAssessmentsSeedPortOptions,
): AssessmentsSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-assessments-seed',
  }

  return {
    createAssessment: record => withSeedPortError('assessments.createAssessment', async () => {
      await postCoreCommand(requestOptions, 'createAssessment', record)
    }),
    recordAssessmentResult: record => withSeedPortError('assessments.recordAssessmentResult', async () => {
      await postCoreCommand(requestOptions, 'recordAssessmentResult', record)
    }),
  }
}
