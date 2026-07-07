import type { HttpSeedRuntimeContext, RunHttpDevSeedsResults } from '../types'
import { createHttpAuthLinkSeedPort } from '../../domains/auth-link/adapters/http'
import { createHttpCommunicationsSeedPort } from '../../domains/communications/adapters/http'
import { runDevAuthLinkWithPort } from '../../orchestration/run-dev-auth-link'
import { runDevAuthProvision } from '../../orchestration/run-dev-auth-provision'
import { logDevSeedResults } from '../../orchestration/run-dev-seeds'
import { canUseSeedingServiceAccount, createEmptyHttpSeedResults, hasSeededSchools } from '../helpers'

export async function runAuthScope(ctx: HttpSeedRuntimeContext): Promise<RunHttpDevSeedsResults> {
  const { auth, client, options } = ctx
  const results = createEmptyHttpSeedResults()

  results.authProvision = await runDevAuthProvision(auth, { baseUrl: client.origin })

  const seedingApiKey = ctx.profileSeedingApiKey
  const canListSchoolsViaHttp = Boolean(options.serviceAccountApiKey)
    || await canUseSeedingServiceAccount(client, seedingApiKey)
  if (canListSchoolsViaHttp && await hasSeededSchools(client, seedingApiKey)) {
    results.authLink = await runDevAuthLinkWithPort(
      createHttpAuthLinkSeedPort({ client, serviceAccountApiKey: seedingApiKey }),
      auth,
      {
        communicationsPort: createHttpCommunicationsSeedPort({
          client,
          serviceAccountApiKey: seedingApiKey,
        }),
      },
    )
  }

  if (options.log) {
    logDevSeedResults(results, options.log)
  }

  return results
}
