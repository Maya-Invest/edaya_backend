import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { CurriculumSeedPort } from '../port'
import { Subject } from '@edaya/core'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand } from '../../../transport/http/core-entity'

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
      await postCoreCommand(requestOptions, 'configureSubject', new Subject(record).data)
    }),
    saveSubjectMatter: record => withSeedPortError('curriculum.saveSubjectMatter', async () => {
      await postCoreCommand(requestOptions, 'configureSubjectMatter', record)
    }),
    offerSubjectToGradeLevel: record => withSeedPortError('curriculum.offerSubjectToGradeLevel', async () => {
      await postCoreCommand(requestOptions, 'offerSubjectToGradeLevel', record)
    }),
    assignMatterToGradeLevelSubject: record => withSeedPortError('curriculum.assignMatterToGradeLevelSubject', async () => {
      await postCoreCommand(requestOptions, 'assignMatterToGradeLevelSubject', record)
    }),
  }
}
