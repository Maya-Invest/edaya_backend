import type { HttpSeedClient } from '../../http/client'
import type { CoreHttpRequestOptions } from '../../http/core-entity'
import type { LearningContentSeedPort } from './port'
import { postEntitySave } from '../../http/core-entity'
import { withSeedPortError } from '../../support/seed-port-error'

export interface CreateHttpLearningContentSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpLearningContentSeedPort(
  options: CreateHttpLearningContentSeedPortOptions,
): LearningContentSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-learning-content-seed',
  }

  return {
    saveHomeworkAssignment: record =>
      withSeedPortError('learningContent.saveHomeworkAssignment', async () => {
        await postEntitySave(requestOptions, 'homeworkAssignments', record)
      }),
    saveHomeworkSubmission: record =>
      withSeedPortError('learningContent.saveHomeworkSubmission', async () => {
        await postEntitySave(requestOptions, 'homeworkSubmissions', record)
      }),
    saveClassLogbookEntry: record =>
      withSeedPortError('learningContent.saveClassLogbookEntry', async () => {
        await postEntitySave(requestOptions, 'classLogbookEntries', record)
      }),
  }
}
