import type { HttpSeedRuntimeContext, RunHttpDevSeedsResults } from '../types'
import {
  logProvisionedEdayaSparkS2sClient,
  provisionEdayaSparkS2sClientHttp,
} from '../../bootstrap/s2s-client'
import { createEmptyHttpSeedResults } from '../helpers'

export async function runS2sClientsScope(ctx: HttpSeedRuntimeContext): Promise<RunHttpDevSeedsResults> {
  const result = await provisionEdayaSparkS2sClientHttp(ctx.client, {
    schoolId: ctx.seedContext.schoolId,
  })
  logProvisionedEdayaSparkS2sClient(result)
  return createEmptyHttpSeedResults()
}
