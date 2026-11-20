import type { S2sClientRepository } from '@edaya/core'
import { randomUUID } from 'node:crypto'
import { S2sClient } from '@edaya/core'
import { encodeS2sApiKey, generateS2sApiKey } from '../service-accounts/api-key-crypto'

export const EDAYA_SPARK_S2S_CLIENT_ID = 'edaya-spark'

export type EdayaSparkS2sKeyMode = 'deterministic' | 'random'

export function resolveEdayaSparkS2sKeyMode(nodeEnv: string): EdayaSparkS2sKeyMode {
  return nodeEnv === 'production' ? 'random' : 'deterministic'
}

/** Local/dev plaintext; EDaya Spark derives the same string from `schoolId`. */
export function localEdayaSparkS2sApiKey(schoolId: string): string {
  return `s2s_live_local_${schoolId.replaceAll('-', '')}_edaya_spark01`
}

export interface ProvisionEdayaSparkReadS2sClientInput {
  schoolId: string
  createdBySubjectId: string
  keyMode: EdayaSparkS2sKeyMode
}

export interface ProvisionEdayaSparkReadS2sClientResult {
  client: S2sClient
  created: boolean
  apiKey?: string
}

export async function provisionEdayaSparkReadS2sClient(
  repository: S2sClientRepository,
  input: ProvisionEdayaSparkReadS2sClientInput,
): Promise<ProvisionEdayaSparkReadS2sClientResult> {
  const existing = await repository.findActiveBySchoolAndClientId(
    input.schoolId,
    EDAYA_SPARK_S2S_CLIENT_ID,
  )
  if (existing) {
    return { client: existing, created: false }
  }

  const generated = input.keyMode === 'deterministic'
    ? encodeS2sApiKey(localEdayaSparkS2sApiKey(input.schoolId))
    : generateS2sApiKey()

  const client = new S2sClient({
    id: randomUUID(),
    schoolId: input.schoolId,
    clientId: EDAYA_SPARK_S2S_CLIENT_ID,
    accessClass: 'read',
    keyPrefix: generated.prefix,
    keyHash: generated.hash,
    createdBySubjectId: input.createdBySubjectId,
  })
  await repository.save(client)
  return { client, created: true, apiKey: generated.plaintext }
}
