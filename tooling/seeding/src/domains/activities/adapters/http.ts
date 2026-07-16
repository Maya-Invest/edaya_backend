import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { ActivitiesSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postEntitySave } from '../../../transport/http/core-entity'

export interface CreateHttpActivitiesSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpActivitiesSeedPort(
  options: CreateHttpActivitiesSeedPortOptions,
): ActivitiesSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-activities-seed',
  }

  return {
    saveActivity: record => withSeedPortError('activities.saveActivity', async () => {
      await postCoreCommand(requestOptions, 'configureActivity', record)
    }),
    saveEnrollment: record => withSeedPortError('activities.saveEnrollment', async () => {
      await postCoreCommand(requestOptions, 'enrollStudentInActivity', record)
    }),
    saveClassActivityEnrollment: record => withSeedPortError('activities.saveClassActivityEnrollment', async () => {
      await postEntitySave(requestOptions, 'classActivityEnrollments', {
        ...record,
        createdAt: new Date().toISOString(),
      })
    }),
  }
}
