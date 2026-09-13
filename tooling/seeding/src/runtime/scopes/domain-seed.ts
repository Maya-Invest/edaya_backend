import type { DevSeedScope } from '../../orchestration/run-dev-seeds'
import type { HttpSeedRuntimeContext, RunHttpDevSeedsResults } from '../types'
import {
  logProvisionedServiceAccountKey,
  provisionSeedingServiceAccountHttp,
} from '../../bootstrap/service-account'
import { bootstrapHttpCoreSession } from '../../bootstrap/session/http-core-session'
import { throwHttpBootstrapFailure } from '../../bootstrap/session/local-dev-errors'
import { logDevSeedResults, runDevSeeds } from '../../orchestration/run-dev-seeds'
import { isSeedingServiceAccountApiKeyReady } from '../../transport/http/verify-service-account'
import { createEmptyHttpSeedResults, maybeProvisionSeedingServiceAccount } from '../helpers'
import { createHttpAccessSeedPort, createHttpDomainSeedPorts } from '../http-domain-ports'
import {
  logProvisionedChildrenAiS2sClient,
  provisionChildrenAiS2sClientHttp,
} from '../../bootstrap/s2s-client'

export async function runDomainSeedScope(ctx: HttpSeedRuntimeContext): Promise<RunHttpDevSeedsResults> {
  const { auth, client, options, scope, serviceAccountApiKey, profileSeedingApiKey } = ctx
  const results = createEmptyHttpSeedResults()

  if (!serviceAccountApiKey) {
    try {
      await bootstrapHttpCoreSession(client)
    }
    catch (error) {
      throwHttpBootstrapFailure(error)
    }
  }

  let seedingAuthKey = serviceAccountApiKey
  if (!seedingAuthKey && scope === 'all') {
    const provision = await provisionSeedingServiceAccountHttp(client, {
      schoolId: ctx.seedContext.schoolId,
      apiKey: profileSeedingApiKey,
    })
    logProvisionedServiceAccountKey(provision)
    if (provision.apiKey && await isSeedingServiceAccountApiKeyReady(client, provision.apiKey)) {
      seedingAuthKey = provision.apiKey
    }
  }

  const accessPort = createHttpAccessSeedPort({ client, serviceAccountApiKey: seedingAuthKey })
  const ports = createHttpDomainSeedPorts(client, seedingAuthKey)

  const domainResults = await runDevSeeds({
    scope: scope as DevSeedScope,
    auth,
    ...ports,
    accessSeedPort: accessPort,
    apiBaseUrl: client.origin,
    skipProfilePhotos: options.skipProfilePhotos,
    skipAttachments: options.skipAttachments,
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
    const s2s = await provisionChildrenAiS2sClientHttp(client, {
      schoolId: ctx.seedContext.schoolId,
    })
    logProvisionedChildrenAiS2sClient(s2s)
  }

  if (options.log) {
    logDevSeedResults(domainResults, options.log)
  }

  return results
}
