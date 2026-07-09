import type { HttpSeedRuntimeContext, RunHttpDevSeedsResults } from '../types'
import { runHttpSeedValidation } from '../../diagnostics/seed-validation'
import { createEmptyHttpSeedResults } from '../helpers'
import { logHttpDevSeedResults } from '../log-http-results'

export async function runValidateScope(ctx: HttpSeedRuntimeContext): Promise<RunHttpDevSeedsResults> {
  const { client, options, serviceAccountApiKey } = ctx
  const results = createEmptyHttpSeedResults()

  results.validation = await runHttpSeedValidation({
    client,
    serviceAccountApiKey,
    skipProfilePhotos: options.skipProfilePhotos,
  })

  if (options.log) {
    logHttpDevSeedResults(results, options.log)
  }

  return results
}
