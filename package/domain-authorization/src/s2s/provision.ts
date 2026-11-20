import type { AtomicExecutionPort, S2sAccessClass } from '@edaya/core'
import type { PlatformActorMetadata } from '../model/actor'
import type { AuthorizationRepositories } from '../ports/authorization-repositories'
import { randomUUID } from 'node:crypto'
import { BusinessRuleViolationError, S2sClient } from '@edaya/core'
import { PlatformPolicies } from '../access/platform-policies'
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

async function performCreateS2sClient(
  repositories: AuthorizationRepositories,
  actor: PlatformActorMetadata,
  input: CreateS2sClientInput,
): Promise<CreateS2sClientResult> {
  await new PlatformPolicies(actor, repositories.platformUsers).createClient()
  const repository = repositories.s2sClients

  if (!await repositories.schools.findById(input.schoolId))
    throw new BusinessRuleViolationError('SCHOOL_NOT_FOUND', 'School not found')
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
  repositories: AuthorizationRepositories,
  actor: PlatformActorMetadata,
  schoolId?: string,
): Promise<S2sClient[]> {
  await new PlatformPolicies(actor, repositories.platformUsers).readClients()
  const repository = repositories.s2sClients
  return repository.list(schoolId ? { schoolId } : undefined)
}

async function performRevokeS2sClient(
  repositories: AuthorizationRepositories,
  actor: PlatformActorMetadata,
  id: string,
): Promise<S2sClient> {
  await new PlatformPolicies(actor, repositories.platformUsers).revokeClient()
  const repository = repositories.s2sClients
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

async function performRotateS2sClientKey(
  repositories: AuthorizationRepositories,
  actor: PlatformActorMetadata,
  id: string,
  apiKey?: string,
): Promise<CreateS2sClientResult> {
  await new PlatformPolicies(actor, repositories.platformUsers).rotateClientKey()
  const repository = repositories.s2sClients
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

export async function createS2sClient(repositories: AuthorizationRepositories, actor: PlatformActorMetadata, input: CreateS2sClientInput, atomic: AtomicExecutionPort): Promise<CreateS2sClientResult> {
  return atomic.execute(() => performCreateS2sClient(repositories, actor, input), { lockKeys: ['platform-users', `s2s:${input.schoolId}`] })
}

export async function revokeS2sClient(repositories: AuthorizationRepositories, actor: PlatformActorMetadata, id: string, atomic: AtomicExecutionPort): Promise<S2sClient> {
  return atomic.execute(() => performRevokeS2sClient(repositories, actor, id), { lockKeys: ['platform-users', `s2s-client:${id}`] })
}

export async function rotateS2sClientKey(repositories: AuthorizationRepositories, actor: PlatformActorMetadata, id: string, apiKey: string | undefined, atomic: AtomicExecutionPort): Promise<CreateS2sClientResult> {
  return atomic.execute(() => performRotateS2sClientKey(repositories, actor, id, apiKey), { lockKeys: ['platform-users', `s2s-client:${id}`] })
}
