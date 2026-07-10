import type { DevSeedScope } from '../../orchestration/run-dev-seeds'
import type { HttpSeedRuntimeContext, RunHttpDevSeedsResults } from '../types'
import { bootstrapHttpCoreSession } from '../../bootstrap/session/http-core-session'
import { throwHttpBootstrapFailure } from '../../bootstrap/session/local-dev-errors'
import { logDevSeedResults, runDevSeeds } from '../../orchestration/run-dev-seeds'
import { createEmptyHttpSeedResults, maybeProvisionSeedingServiceAccount } from '../helpers'
import { createHttpAccessSeedPort, createHttpDomainSeedPorts } from '../http-domain-ports'

export async function runDomainSeedScope(ctx: HttpSeedRuntimeContext): Promise<RunHttpDevSeedsResults> {
  const { auth, client, options, scope, serviceAccountApiKey } = ctx
  const results = createEmptyHttpSeedResults()

  if (!serviceAccountApiKey) {
    try {
      await bootstrapHttpCoreSession(client)
    }
    catch (error) {
      throwHttpBootstrapFailure(error)
    }
  }

  const accessPort = createHttpAccessSeedPort({ client, serviceAccountApiKey })
  const ports = createHttpDomainSeedPorts(client, serviceAccountApiKey)

  const domainResults = await runDevSeeds({
    scope: scope as DevSeedScope,
    auth,
    ...ports,
    accessSeedPort: accessPort,
    apiBaseUrl: client.origin,
    skipProfilePhotos: options.skipProfilePhotos,
    profilePhotosSkipReason: options.profilePhotosSkipReason,
    progress: options.progress,
    ...(scope === 'all' && !serviceAccountApiKey
      ? { skipAuthProvision: true }
      : {}),
  })

  results.school = domainResults.school
  results.authProvision = domainResults.authProvision
  results.authLink = domainResults.authLink
  results.access = domainResults.access
  results.profilePhotos = domainResults.profilePhotos
  results.profilePhotosSkipped = domainResults.profilePhotosSkipped
  results.profilePhotosSkipReason = domainResults.profilePhotosSkipReason

  if (scope === 'all') {
    await maybeProvisionSeedingServiceAccount(options, serviceAccountApiKey)
  }

  if (options.log) {
    logDevSeedResults(domainResults, options.log)
  }

  return results
}
