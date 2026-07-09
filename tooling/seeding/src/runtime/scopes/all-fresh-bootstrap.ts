import type { HttpSeedRuntimeContext, RunHttpDevSeedsResults } from '../types'
import { ownerSubjectIdFromAuthProvision } from '../../bootstrap/dev-staff-auth-seed'
import {
  logProvisionedServiceAccountKey,
  provisionSeedingServiceAccountHttp,
} from '../../bootstrap/service-account'
import { bootstrapHttpCoreSession } from '../../bootstrap/session/http-core-session'
import { throwHttpBootstrapFailure } from '../../bootstrap/session/local-dev-errors'
import {
  runDevAccessAssignmentsSeedWithPort,
  runDevAccessRolesSeedWithPort,
} from '../../orchestration/run-dev-access-seed'
import { runDevAuthProvision } from '../../orchestration/run-dev-auth-provision'
import { runDevSchoolSeed } from '../../orchestration/run-dev-school-seed'
import { logDevSeedResults } from '../../orchestration/run-dev-seeds'
import { runSeedProgressStep } from '../../support/seed-progress'
import { canUseSeedingServiceAccount, createEmptyHttpSeedResults } from '../helpers'
import { createHttpAccessSeedPort, createHttpDomainSeedPorts } from '../http-domain-ports'

/** Fresh-database `all` path: auth → bootstrap session → roles → service account → school → access. */
export async function tryRunAllFreshBootstrap(
  ctx: HttpSeedRuntimeContext,
): Promise<RunHttpDevSeedsResults | null> {
  const { auth, client, options, seedContext, serviceAccountApiKey } = ctx
  const seedingApiKey = ctx.profileSeedingApiKey
  const progress = options.progress

  if (
    ctx.scope !== 'all'
    || serviceAccountApiKey
    || await canUseSeedingServiceAccount(client, seedingApiKey)
  ) {
    return null
  }

  const results = createEmptyHttpSeedResults()
  results.authProvision = await runDevAuthProvision(auth, {
    baseUrl: client.origin,
    progress,
  })

  await runSeedProgressStep(progress, async () => {
    try {
      await bootstrapHttpCoreSession(client)
    }
    catch (error) {
      throwHttpBootstrapFailure(error)
    }
  })

  const ownerSubjectId = results.authProvision
    ? ownerSubjectIdFromAuthProvision(results.authProvision)
    : undefined

  await runSeedProgressStep(progress, async () => {
    await runDevAccessRolesSeedWithPort(createHttpAccessSeedPort({ client }))
  })

  const provision = await runSeedProgressStep(progress, async () =>
    provisionSeedingServiceAccountHttp(client, {
      schoolId: seedContext.schoolId,
      apiKey: seedingApiKey,
    }))
  logProvisionedServiceAccountKey(provision)

  const serviceAccountApiKeyFromProvision = provision.apiKey ?? seedingApiKey
  if (!serviceAccountApiKeyFromProvision) {
    throw new Error(
      'Seeding service account already exists but the profile API key is not available. '
      + 'Run `bun repo seed --scope service-account` or wipe `.data` and run `bun repo seed`.',
    )
  }

  const ports = createHttpDomainSeedPorts(client, serviceAccountApiKeyFromProvision)

  results.school = await runDevSchoolSeed(undefined, {
    auth,
    ownerSubjectId,
    ...ports,
    apiBaseUrl: client.origin,
    skipProfilePhotos: options.skipProfilePhotos,
    progress,
  })
  results.access = await runDevAccessAssignmentsSeedWithPort(
    createHttpAccessSeedPort({ client, serviceAccountApiKey: serviceAccountApiKeyFromProvision }),
    { progress },
  )
  if (options.skipProfilePhotos) {
    results.profilePhotos = 0
    results.profilePhotosSkipped = true
    results.profilePhotosSkipReason = options.profilePhotosSkipReason
  }

  if (options.log) {
    logDevSeedResults({
      school: results.school,
      authProvision: results.authProvision,
      authLink: results.authLink,
      access: results.access,
      profilePhotos: results.profilePhotos,
      profilePhotosSkipped: results.profilePhotosSkipped,
      profilePhotosSkipReason: options.profilePhotosSkipReason,
    }, options.log)
  }

  return results
}
