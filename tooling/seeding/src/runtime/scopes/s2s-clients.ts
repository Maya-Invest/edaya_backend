import type { HttpSeedRuntimeContext, RunHttpDevSeedsResults } from '../types'
import {
  logProvisionedChildrenAiS2sClient,
  provisionChildrenAiS2sClientHttp,
} from '../../bootstrap/s2s-client'
import { createEmptyHttpSeedResults } from '../helpers'

export async function runS2sClientsScope(ctx: HttpSeedRuntimeContext): Promise<RunHttpDevSeedsResults> {
  const result = await provisionChildrenAiS2sClientHttp(ctx.client, {
    schoolId: ctx.seedContext.schoolId,
  })
  logProvisionedChildrenAiS2sClient(result)
  return createEmptyHttpSeedResults()
}
