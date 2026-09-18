import type { S2sClientRepository } from '@edaya/core'
import { randomUUID } from 'node:crypto'
import { S2sClient } from '@edaya/core'
import { encodeS2sApiKey, generateS2sApiKey } from '../service-accounts/api-key-crypto'

export const CHILDREN_AI_S2S_CLIENT_ID = 'children-ai'

export type ChildrenAiS2sKeyMode = 'deterministic' | 'random'

export function resolveChildrenAiS2sKeyMode(nodeEnv: string): ChildrenAiS2sKeyMode {
  return nodeEnv === 'production' ? 'random' : 'deterministic'
}

/** Local/dev plaintext; Children AI derives the same string from `schoolId`. */
export function localChildrenAiS2sApiKey(schoolId: string): string {
  return `s2s_live_local_${schoolId.replaceAll('-', '')}_children_ai01`
}

export interface ProvisionChildrenAiReadS2sClientInput {
  schoolId: string
  createdBySubjectId: string
  keyMode: ChildrenAiS2sKeyMode
}

export interface ProvisionChildrenAiReadS2sClientResult {
  client: S2sClient
  created: boolean
  apiKey?: string
}

export async function provisionChildrenAiReadS2sClient(
  repository: S2sClientRepository,
  input: ProvisionChildrenAiReadS2sClientInput,
): Promise<ProvisionChildrenAiReadS2sClientResult> {
  const existing = await repository.findActiveBySchoolAndClientId(
    input.schoolId,
    CHILDREN_AI_S2S_CLIENT_ID,
  )
  if (existing) {
    return { client: existing, created: false }
  }

  const generated = input.keyMode === 'deterministic'
    ? encodeS2sApiKey(localChildrenAiS2sApiKey(input.schoolId))
    : generateS2sApiKey()

  const client = new S2sClient({
    id: randomUUID(),
    schoolId: input.schoolId,
    clientId: CHILDREN_AI_S2S_CLIENT_ID,
    accessClass: 'read',
    keyPrefix: generated.prefix,
    keyHash: generated.hash,
    createdBySubjectId: input.createdBySubjectId,
  })
  await repository.save(client)
  return { client, created: true, apiKey: generated.plaintext }
}
