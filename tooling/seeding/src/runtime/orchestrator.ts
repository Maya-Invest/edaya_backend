import type { HttpSeedRuntimeContext, RunHttpDevSeedsOptions } from './types'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { resolveSeedingApiKeyForSchool } from '@edaya/fixtures/meta/school-profiles'
import { HttpAuthProvisioner } from '../bootstrap/auth/http-provisioner'
import {
  resolveAllSeedPhaseLabels,
  resolveFreshBootstrapPhaseLabels,
  resolveSeedPhaseLabels,
} from '../support/resolve-seed-progress-plan'
import { createSeedProgressReporter } from '../support/seed-progress'
import { canUseSeedingServiceAccount, resolveServiceAccountApiKey } from './helpers'
import { tryRunAllFreshBootstrap } from './scopes/all-fresh-bootstrap'
import { runAuthScope } from './scopes/auth'
import { runDoctorScope } from './scopes/doctor'
import { runDomainSeedScope } from './scopes/domain-seed'
import { runServiceAccountScope } from './scopes/service-account'
import { runSmokeScope } from './scopes/smoke'
import { runValidateScope } from './scopes/validate'

export { logHttpDevSeedResults } from './log-http-results'

export { parseHttpDevSeedScope } from './parse-scope'
export type {
  HttpDevSeedScope,
  HttpSmokeSeedResult,
  RunHttpDevSeedsOptions,
  RunHttpDevSeedsResults,
} from './types'
export { runHttpVerifyDemoStaffGrants } from './verify-demo-staff-grants'

async function buildRuntimeContext(options: RunHttpDevSeedsOptions): Promise<HttpSeedRuntimeContext> {
  const { client, scope } = options
  const auth = options.auth ?? new HttpAuthProvisioner(client)
  const seedContext = resolveDevSeedContext()
  const profileSeedingApiKey = resolveSeedingApiKeyForSchool(seedContext.schoolId)
  const serviceAccountApiKey = await resolveServiceAccountApiKey(client, options, profileSeedingApiKey)

  let progress = options.progress
  if (!progress && !options.noProgress) {
    const skipProfilePhotos = options.skipProfilePhotos ?? false
    let phases = resolveSeedPhaseLabels(scope, skipProfilePhotos)
    if (scope === 'all') {
      const usesExistingServiceAccount = Boolean(serviceAccountApiKey)
        || await canUseSeedingServiceAccount(client, profileSeedingApiKey)
      phases = usesExistingServiceAccount
        ? resolveAllSeedPhaseLabels(skipProfilePhotos, { skipAuth: true })
        : resolveFreshBootstrapPhaseLabels(skipProfilePhotos)
    }
    progress = createSeedProgressReporter(phases)
  }

  return {
    options: {
      ...options,
      progress,
    },
    auth,
    client,
    scope,
    serviceAccountApiKey,
    profileSeedingApiKey,
    seedContext,
  }
}

export async function runHttpDevSeeds(options: RunHttpDevSeedsOptions) {
  const ctx = await buildRuntimeContext(options)

  try {
    switch (ctx.scope) {
      case 'doctor':
        return await runDoctorScope(ctx)
      case 'validate':
        return await runValidateScope(ctx)
      case 'auth':
        return await runAuthScope(ctx)
      case 'smoke':
        return await runSmokeScope(ctx)
      case 'service-account':
        return await runServiceAccountScope(ctx)
      case 'all': {
        const freshBootstrap = await tryRunAllFreshBootstrap(ctx)
        if (freshBootstrap) {
          return freshBootstrap
        }
        return await runDomainSeedScope(ctx)
      }
      default:
        return await runDomainSeedScope(ctx)
    }
  }
  finally {
    ctx.options.progress?.finish()
  }
}
