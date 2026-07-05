import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { DisciplineSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand } from '../../../transport/http/core-entity'

export interface CreateHttpDisciplineSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpDisciplineSeedPort(
  options: CreateHttpDisciplineSeedPortOptions,
): DisciplineSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-discipline-seed',
  }

  return {
    saveDisciplinaryAction: record =>
      withSeedPortError('discipline.saveDisciplinaryAction', async () => {
        await postCoreCommand(requestOptions, 'configureDisciplinaryAction', record)
      }),
    applyDisciplinaryAction: record =>
      withSeedPortError('discipline.applyDisciplinaryAction', async () => {
        await postCoreCommand(requestOptions, 'applyDisciplinaryAction', record)
      }),
    updateStudentDisciplinaryActionStatus: record =>
      withSeedPortError('discipline.updateStudentDisciplinaryActionStatus', async () => {
        await postCoreCommand(requestOptions, 'updateStudentDisciplinaryActionStatus', record)
      }),
  }
}
