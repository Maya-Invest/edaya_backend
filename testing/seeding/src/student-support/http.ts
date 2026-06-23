import type { HttpSeedClient } from '../http/client'
import type { CoreHttpRequestOptions } from '../http/core-entity'
import type { StudentSupportSeedPort } from './port'
import { postCoreCommand } from '../http/core-entity'
import { withSeedPortError } from '../seed-port-error'

export interface CreateHttpStudentSupportSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpStudentSupportSeedPort(
  options: CreateHttpStudentSupportSeedPortOptions,
): StudentSupportSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-student-support-seed',
  }

  return {
    upsertStudentHealthProfile: record =>
      withSeedPortError('studentSupport.upsertStudentHealthProfile', async () => {
        await postCoreCommand(requestOptions, 'upsertStudentHealthProfile', record)
      }),
    createStudentNote: record => withSeedPortError('studentSupport.createStudentNote', async () => {
      await postCoreCommand(requestOptions, 'createStudentNote', record)
    }),
  }
}
