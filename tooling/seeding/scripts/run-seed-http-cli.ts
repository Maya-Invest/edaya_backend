#!/usr/bin/env bun

import type { HttpDevSeedScope } from '../src/http/index.ts'
import type { SeedCliInvocation } from '../src/support/parse-seed-cli.ts'
import type { SeedHttpTarget } from '../src/support/resolve-seed-env.ts'
import { resolveActiveSeedSchoolId } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { resolveSeedingApiKeyForSchool } from '@edaya/fixtures/meta/school-profiles'
import {
  resolveProfilePhotoSeedPlan,
  seedScopeUsesProfilePhotos,
} from '../src/diagnostics/profile-photo-preflight.ts'
import {
  HttpSeedClient,
  logHttpDevSeedResults,
  runHttpDevSeeds,
} from '../src/http/index.ts'
import { waitForApi } from '../src/http/wait-for-api.ts'
import { loadSeedEnvFiles } from '../src/support/load-seed-env.ts'
import {
  resolveSeedApiUrl,
  resolveSeedAppOrigin,

} from '../src/support/resolve-seed-env.ts'

export function resolveSeedHttpConfig(target: SeedHttpTarget) {
  loadSeedEnvFiles()
  const schoolId = resolveActiveSeedSchoolId()
  return {
    baseUrl: resolveSeedApiUrl(target),
    appOrigin: resolveSeedAppOrigin(target),
    schoolId,
    serviceAccountApiKey: resolveSeedingApiKeyForSchool(schoolId),
  }
}

export async function runSeedHttpCli(
  invocation: Extract<SeedCliInvocation, { kind: 'seed' }>,
): Promise<number> {
  const { baseUrl, appOrigin, serviceAccountApiKey } = resolveSeedHttpConfig(invocation.target)
  const scope: HttpDevSeedScope = invocation.scope

  const client = new HttpSeedClient({ baseUrl, appOrigin })

  if (scope !== 'auth') {
    console.log(`Waiting for API at ${baseUrl}...`)
    await waitForApi(baseUrl)
  }

  let skipProfilePhotos = invocation.skipProfilePhotos
  let profilePhotosSkipReason: string | undefined

  if (seedScopeUsesProfilePhotos(scope) || (scope === 'validate' && invocation.skipProfilePhotos)) {
    const plan = await resolveProfilePhotoSeedPlan({
      apiBaseUrl: baseUrl,
      skipProfilePhotos: invocation.skipProfilePhotos,
      requirePhotoUpload: scope === 'profile-pictures',
    })
    skipProfilePhotos = !plan.seedProfilePhotos
    profilePhotosSkipReason = plan.reason
    if (skipProfilePhotos && plan.reason) {
      console.log(`Profile photos: ${plan.reason}`)
    }
  }

  const results = await runHttpDevSeeds({
    client,
    scope,
    serviceAccountApiKey,
    provisionServiceAccount: scope === 'all',
    skipProfilePhotos: skipProfilePhotos || undefined,
    skipAttachments: invocation.skipAttachments || undefined,
    profilePhotosSkipReason,
    noProgress: invocation.noProgress,
    repair: scope === 'doctor' ? invocation.repair : undefined,
  })

  logHttpDevSeedResults(results)

  if (
    results.validation?.status === 'failed'
    || results.doctor?.status === 'broken'
    || (
      results.doctorRepair
      && results.doctorRepair.repairs.length > 0
      && results.doctorRepair.after.status !== 'healthy'
    )
  ) {
    return 1
  }

  return 0
}
