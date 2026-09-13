import type { AtomicExecutionPort, PlatformAction, PlatformUserRepository } from '@edaya/core'
import type { PlatformActorMetadata } from '../model/actor'
import { randomUUID } from 'node:crypto'
import {
  ALL_PLATFORM_PERMISSIONS,
  BusinessRuleViolationError,
  PlatformUser,
} from '@edaya/core'
import { PlatformPolicies } from '../access/platform-policies'

export const PLATFORM_BOOTSTRAP_SUBJECT_ID = 'bootstrap'

export interface CreatePlatformUserInput {
  subjectId: string
  email: string
  permissions?: readonly PlatformAction[]
}

export interface BootstrapPlatformUserInput {
  subjectId: string
  email: string
}

async function performCreatePlatformUser(
  repository: PlatformUserRepository,
  actor: PlatformActorMetadata,
  input: CreatePlatformUserInput,
): Promise<PlatformUser> {
  const permissions = await new PlatformPolicies(actor, repository).createUser(input.permissions)

  const email = input.email.trim().toLowerCase()
  const existingSubject = await repository.findBySubjectId(input.subjectId)
  if (existingSubject) {
    throw new BusinessRuleViolationError(
      'PLATFORM_USER_SUBJECT_CONFLICT',
      'A platform user already exists for this identity',
    )
  }

  const existingEmail = await repository.findByEmail(email)
  if (existingEmail) {
    throw new BusinessRuleViolationError(
      'PLATFORM_USER_EMAIL_CONFLICT',
      'A platform user already exists for this email',
    )
  }

  const user = new PlatformUser({
    id: randomUUID(),
    subjectId: input.subjectId,
    email,
    permissions,
    isActive: true,
    createdBySubjectId: actor.subjectId,
  })
  await repository.save(user)
  return user
}

export async function listPlatformUsers(
  repository: PlatformUserRepository,
  actor: PlatformActorMetadata,
): Promise<PlatformUser[]> {
  await new PlatformPolicies(actor, repository).readUsers()
  return repository.list()
}

async function performDeactivatePlatformUser(
  repository: PlatformUserRepository,
  actor: PlatformActorMetadata,
  id: string,
): Promise<PlatformUser> {
  await new PlatformPolicies(actor, repository).deactivateUser(id)

  const existing = await repository.findById(id)
  if (!existing || !existing.isActive) {
    throw new BusinessRuleViolationError(
      'PLATFORM_USER_NOT_FOUND',
      'Platform user not found',
    )
  }

  const updated = new PlatformUser({
    ...existing.data,
    isActive: false,
    updatedAt: new Date(),
  })
  await repository.save(updated)
  return updated
}

/** Insert the first operator when env allowlists the JWT email and no row exists. */
export async function bootstrapPlatformUserIfAbsent(
  repository: PlatformUserRepository,
  input: BootstrapPlatformUserInput,
): Promise<PlatformUser | undefined> {
  const existing = await repository.findBySubjectId(input.subjectId)
  if (existing) {
    return existing.isActive ? existing : undefined
  }

  const email = input.email.trim().toLowerCase()
  const existingEmail = await repository.findByEmail(email)
  if (existingEmail) {
    return undefined
  }

  const user = new PlatformUser({
    id: randomUUID(),
    subjectId: input.subjectId,
    email,
    permissions: [...ALL_PLATFORM_PERMISSIONS],
    isActive: true,
    createdBySubjectId: PLATFORM_BOOTSTRAP_SUBJECT_ID,
  })
  await repository.save(user)
  return user
}

export async function createPlatformUser(repository: PlatformUserRepository, actor: PlatformActorMetadata, input: CreatePlatformUserInput, atomic: AtomicExecutionPort): Promise<PlatformUser> {
  return atomic.execute(() => performCreatePlatformUser(repository, actor, input), { lockKeys: ['platform-users'] })
}

export async function deactivatePlatformUser(repository: PlatformUserRepository, actor: PlatformActorMetadata, id: string, atomic: AtomicExecutionPort): Promise<PlatformUser> {
  return atomic.execute(() => performDeactivatePlatformUser(repository, actor, id), { lockKeys: ['platform-users'] })
}
