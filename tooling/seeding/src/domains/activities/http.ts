import type { HttpSeedClient } from '../../http/client'
import type { CoreHttpRequestOptions } from '../../http/core-entity'
import type { ActivitiesSeedPort } from './port'
import { postEntitySave } from '../../http/core-entity'
import { withSeedPortError } from '../../support/seed-port-error'

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
      await postEntitySave(requestOptions, 'activities', record)
    }),
    saveEnrollment: record => withSeedPortError('activities.saveEnrollment', async () => {
      await postEntitySave(requestOptions, 'activityEnrollments', record)
    }),
  }
}
