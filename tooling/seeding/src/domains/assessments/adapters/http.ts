import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { AssessmentsSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand } from '../../../transport/http/core-entity'

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
