import type { PlatformPermission, PlatformUserRepository } from '@edaya/core'
import type { PlatformActorMetadata } from '../model/actor'
import { randomUUID } from 'node:crypto'
import {
  ALL_PLATFORM_PERMISSIONS,
  BusinessRuleViolationError,
  PlatformUser,
} from '@edaya/core'
import { operationModule } from '../gates/operation-module'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'
import { PlatformUserOperations } from '../operations/platform-users'

export const PLATFORM_BOOTSTRAP_SUBJECT_ID = 'bootstrap'

export interface CreatePlatformUserInput {
  subjectId: string
  email: string
  permissions?: readonly PlatformPermission[]
}

export interface BootstrapPlatformUserInput {
  subjectId: string
  email: string
}

function assertSubset(
  actor: PlatformActorMetadata,
  permissions: readonly PlatformPermission[],
): void {
  for (const permission of permissions) {
    if (!actor.permissions.has(permission)) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

export async function createPlatformUser(
  repository: PlatformUserRepository,
  actor: PlatformActorMetadata,
  input: CreatePlatformUserInput,
): Promise<PlatformUser> {
  await operationModule(PlatformUserOperations.create)(actor)

  const email = input.email.trim().toLowerCase()
  const permissions = [...new Set(input.permissions ?? [...actor.permissions])]
  if (permissions.length === 0) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  assertSubset(actor, permissions)

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
  await operationModule(PlatformUserOperations.read)(actor)
  return repository.list()
}

export async function deactivatePlatformUser(
  repository: PlatformUserRepository,
  actor: PlatformActorMetadata,
  id: string,
): Promise<PlatformUser> {
  await operationModule(PlatformUserOperations.deactivate)(actor)

  if (id === actor.actorId) {
    throw new BusinessRuleViolationError(
      'PLATFORM_USER_SELF_DEACTIVATE',
      'A platform user cannot deactivate themselves',
    )
  }

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
