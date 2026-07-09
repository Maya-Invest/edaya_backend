import type { HttpSeedRuntimeContext, RunHttpDevSeedsResults } from '../types'
import {
  logProvisionedServiceAccountKey,
  provisionSeedingServiceAccountHttp,
} from '../../bootstrap/service-account'
import { createEmptyHttpSeedResults } from '../helpers'

export async function runServiceAccountScope(ctx: HttpSeedRuntimeContext): Promise<RunHttpDevSeedsResults> {
  const result = await provisionSeedingServiceAccountHttp(ctx.client)
  logProvisionedServiceAccountKey(result)
  return createEmptyHttpSeedResults()
}
