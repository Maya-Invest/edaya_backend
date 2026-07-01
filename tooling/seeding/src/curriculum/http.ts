import type { HttpSeedClient } from '../http/client'
import type { CoreHttpRequestOptions } from '../http/core-entity'
import type { CurriculumSeedPort } from './port'
import { postCoreCommand, postEntitySave } from '../http/core-entity'
import { withSeedPortError } from '../seed-port-error'

export interface CreateHttpCurriculumSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpCurriculumSeedPort(
  options: CreateHttpCurriculumSeedPortOptions,
): CurriculumSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-curriculum-seed',
  }

  return {
    saveSubject: record => withSeedPortError('curriculum.saveSubject', async () => {
      await postEntitySave(requestOptions, 'subjects', record)
    }),
    saveSubjectMatter: record => withSeedPortError('curriculum.saveSubjectMatter', async () => {
      await postEntitySave(requestOptions, 'subjectMatters', record)
    }),
    offerSubjectToGradeLevel: record => withSeedPortError('curriculum.offerSubjectToGradeLevel', async () => {
      await postCoreCommand(requestOptions, 'offerSubjectToGradeLevel', record)
    }),
    assignMatterToGradeLevelSubject: record => withSeedPortError('curriculum.assignMatterToGradeLevelSubject', async () => {
      await postCoreCommand(requestOptions, 'assignMatterToGradeLevelSubject', record)
    }),
  }
}
