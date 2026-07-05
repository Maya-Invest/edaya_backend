import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { StudentSupportSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand } from '../../../transport/http/core-entity'

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
