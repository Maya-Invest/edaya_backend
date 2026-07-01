import type { HttpSeedClient } from '../../http/client'
import type { CoreHttpRequestOptions } from '../../http/core-entity'
import type { DisciplineSeedPort } from './port'
import { postCoreCommand, postEntitySave } from '../../http/core-entity'
import { withSeedPortError } from '../../support/seed-port-error'

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
        await postEntitySave(requestOptions, 'disciplinaryActions', record)
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
