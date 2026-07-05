import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { PopulationSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand } from '../../../transport/http/core-entity'

export interface CreateHttpPopulationSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

export function createHttpPopulationSeedPort(
  options: CreateHttpPopulationSeedPortOptions,
): PopulationSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-population-seed',
  }

  return {
    registerStudent: record => withSeedPortError('population.registerStudent', async () => {
      await postCoreCommand(requestOptions, 'registerStudent', record)
    }),
    enrollStudent: record => withSeedPortError('population.enrollStudent', async () => {
      await postCoreCommand(requestOptions, 'enrollStudent', record)
    }),
    registerGuardian: record => withSeedPortError('population.registerGuardian', async () => {
      await postCoreCommand(requestOptions, 'registerGuardian', record)
    }),
    linkGuardianToStudent: record => withSeedPortError('population.linkGuardianToStudent', async () => {
      await postCoreCommand(requestOptions, 'linkGuardianToStudent', record)
    }),
  }
}
