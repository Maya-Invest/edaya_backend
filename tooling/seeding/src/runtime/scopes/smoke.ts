import type { HttpSeedRuntimeContext, HttpSmokeSeedResult, RunHttpDevSeedsResults } from '../types'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { signInViaHttp } from '../../bootstrap/auth/http-provisioner'
import { createEmptyHttpSeedResults } from '../helpers'

export async function runHttpSmokeSeed(
  ctx: Pick<HttpSeedRuntimeContext, 'client' | 'serviceAccountApiKey'>,
): Promise<HttpSmokeSeedResult> {
  const seedContext = resolveDevSeedContext()

  await signInViaHttp(ctx.client, {
    email: seedContext.minimalStaffEmail,
    password: seedContext.authPassword,
  })

  const staffGrants = await ctx.client.jsonRequest('/core/authorization/effective-grants')
  if (!staffGrants.response.ok) {
    return {
      status: 'failed',
      signInStatus: 200,
      effectiveGrantsStatus: staffGrants.response.status,
      reason: `Effective grants request failed for ${seedContext.minimalStaffEmail}`,
    }
  }

  if (ctx.serviceAccountApiKey) {
    const serviceGrants = await ctx.client.jsonRequest('/core/authorization/effective-grants', {
      headers: {
        authorization: `Bearer ${ctx.serviceAccountApiKey}`,
      },
    })
    if (!serviceGrants.response.ok) {
      return {
        status: 'failed',
        signInStatus: 200,
        effectiveGrantsStatus: serviceGrants.response.status,
        reason: 'Effective grants request failed for seeding service account',
      }
    }
  }

  return {
    status: 'passed',
    signInStatus: 200,
    effectiveGrantsStatus: staffGrants.response.status,
  }
}

export async function runSmokeScope(ctx: HttpSeedRuntimeContext): Promise<RunHttpDevSeedsResults> {
  const results = createEmptyHttpSeedResults()
  results.smoke = await runHttpSmokeSeed(ctx)
  return results
}
