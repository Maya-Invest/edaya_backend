import type { S2sAccessClass, S2sClientRepository } from '@edaya/core'
import type { PlatformActorMetadata } from '../model/actor'
import { randomUUID } from 'node:crypto'
import { BusinessRuleViolationError, S2sClient } from '@edaya/core'
import { operationModule } from '../gates/operation-module'
import { S2sClientOperations } from '../operations/s2s-clients'
import { encodeS2sApiKey, generateS2sApiKey } from '../s2s'

export interface CreateS2sClientInput {
  schoolId: string
  clientId: string
  accessClass: S2sAccessClass
  /** When set, stores this key instead of generating a random one (dev/tests only). */
  apiKey?: string
}

export interface CreateS2sClientResult {
  client: S2sClient
  apiKey: string
}

export async function createS2sClient(
  repository: S2sClientRepository,
  actor: PlatformActorMetadata,
  input: CreateS2sClientInput,
): Promise<CreateS2sClientResult> {
  await operationModule(S2sClientOperations.create)(actor)

  const existing = await repository.findActiveBySchoolAndClientId(input.schoolId, input.clientId)
  if (existing) {
    throw new BusinessRuleViolationError(
      'S2S_CLIENT_ID_CONFLICT',
      `S2S client "${input.clientId}" already exists for this school`,
    )
  }

  const generated = input.apiKey
    ? encodeS2sApiKey(input.apiKey)
    : generateS2sApiKey()

  const client = new S2sClient({
    id: randomUUID(),
    schoolId: input.schoolId,
    clientId: input.clientId,
    accessClass: input.accessClass,
    keyPrefix: generated.prefix,
    keyHash: generated.hash,
    createdBySubjectId: actor.subjectId,
  })
  await repository.save(client)
  return { client, apiKey: generated.plaintext }
}

export async function listS2sClients(
  repository: S2sClientRepository,
  actor: PlatformActorMetadata,
  schoolId?: string,
): Promise<S2sClient[]> {
  await operationModule(S2sClientOperations.read)(actor)
  return repository.list(schoolId ? { schoolId } : undefined)
}

export async function revokeS2sClient(
  repository: S2sClientRepository,
  actor: PlatformActorMetadata,
  id: string,
): Promise<S2sClient> {
  await operationModule(S2sClientOperations.revoke)(actor)
  const existing = await repository.findById(id)
  if (!existing || !existing.isActive()) {
    throw new BusinessRuleViolationError(
      'S2S_CLIENT_NOT_FOUND',
      'S2S client not found',
    )
  }

  const updated = new S2sClient({
    ...existing.data,
    revokedAt: new Date(),
  })
  await repository.save(updated)
  return updated
}

export async function rotateS2sClientKey(
  repository: S2sClientRepository,
  actor: PlatformActorMetadata,
  id: string,
  apiKey?: string,
): Promise<CreateS2sClientResult> {
  await operationModule(S2sClientOperations.rotateKey)(actor)
  const existing = await repository.findById(id)
  if (!existing || !existing.isActive()) {
    throw new BusinessRuleViolationError(
      'S2S_CLIENT_NOT_FOUND',
      'S2S client not found',
    )
  }

  const generated = apiKey ? encodeS2sApiKey(apiKey) : generateS2sApiKey()
  const updated = new S2sClient({
    ...existing.data,
    keyPrefix: generated.prefix,
    keyHash: generated.hash,
  })
  await repository.save(updated)
  return { client: updated, apiKey: generated.plaintext }
}
