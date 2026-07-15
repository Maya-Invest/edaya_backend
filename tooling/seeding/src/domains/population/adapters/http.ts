import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { PopulationSeedPort } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand } from '../../../transport/http/core-entity'
import { isStagingSeedApiUrl } from '../../../support/resolve-seed-env'
import { withStagingHyperdriveRetry } from '../../../transport/http/staging-hyperdrive-retry'

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
  const isStaging = isStagingSeedApiUrl(options.client.origin)

  const runCommand = (
    operation: string,
    methodName: 'registerStudent' | 'enrollStudent' | 'registerGuardian' | 'linkGuardianToStudent',
    record: unknown,
  ) => withSeedPortError(operation, async () => {
    await withStagingHyperdriveRetry(isStaging, async () => {
      await postCoreCommand(requestOptions, methodName, record)
    })
  })

  return {
    registerStudent: record => runCommand('population.registerStudent', 'registerStudent', record),
    enrollStudent: record => runCommand('population.enrollStudent', 'enrollStudent', record),
    registerGuardian: record => runCommand('population.registerGuardian', 'registerGuardian', record),
    linkGuardianToStudent: record => runCommand(
      'population.linkGuardianToStudent',
      'linkGuardianToStudent',
      record,
    ),
  }
}
