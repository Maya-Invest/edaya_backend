import type { StaffMember } from '@edaya/core'
import type {
  Permission,
} from '../'
import type { StaffActorMetadata } from '../model/actor'
import type { AuthorizationRepositories } from '../ports/authorization-repositories'
import { randomUUID } from 'node:crypto'
import {
  BusinessRuleViolationError,
  ServiceApiKey,
  StaffMember as StaffMemberEntity,
  StaffPermissionAssignment,
} from '@edaya/core'
import {
  assertDelegatedPermissionAssignmentsSubset,
  assertOwnerServiceAccountAllowed,
  encodeApiKey,
  generateApiKey,
  ServiceAccountOperations,
} from '../'
import { operationModule } from '../gates/operation-module'

export interface ServiceAccountPermissionAssignmentInput {
  permission: Permission
  scopeIds: string
  academicYearId: string
}

export interface CreateServiceAccountInput {
  serviceId: string
  displayName: string
  permissionAssignments?: readonly ServiceAccountPermissionAssignmentInput[]
  elevated?: boolean
  /** When set, stores this key instead of generating a random one (dev/seeding only). */
  apiKey?: string
}

export interface CreateServiceAccountResult {
  staffMember: StaffMember
  apiKey: string
}

export interface UpdateServiceAccountInput {
  displayName?: string
  permissionAssignments?: readonly ServiceAccountPermissionAssignmentInput[]
}

export async function createServiceAccount(
  repositories: AuthorizationRepositories,
  actor: StaffActorMetadata,
  input: CreateServiceAccountInput,
): Promise<CreateServiceAccountResult> {
  await operationModule(ServiceAccountOperations.create)(actor)

  const schoolId = actor.schoolId
  const elevated = input.elevated ?? false
  const permissionAssignments = input.permissionAssignments ?? []
  assertOwnerServiceAccountAllowed(actor.effectiveGrants, elevated)

  if (elevated) {
    const existing = await repositories.serviceApiKeys.countActiveElevatedServiceAccounts(schoolId)
    if (existing > 0) {
      throw new BusinessRuleViolationError(
        'OWNER_SERVICE_ACCOUNT_LIMIT',
        'School already has an active owner-level service account',
      )
    }
  }

  if (!elevated && permissionAssignments.length === 0) {
    throw new BusinessRuleViolationError(
      'SERVICE_ACCOUNT_GRANTS_REQUIRED',
      'permissionAssignments are required unless elevated',
    )
  }

  if (permissionAssignments.length > 0) {
    assertDelegatedPermissionAssignmentsSubset(
      actor.effectiveGrants,
      permissionAssignments,
      schoolId,
    )
  }

  const existingService = await repositories.staffMembers.findOne({
    schoolId,
    accountKind: 'service',
    serviceId: input.serviceId,
    isActive: true,
  })
  if (existingService) {
    throw new BusinessRuleViolationError(
      'SERVICE_ACCOUNT_ID_CONFLICT',
      `Service account "${input.serviceId}" already exists for this school`,
    )
  }

  const { firstName, lastName } = splitDisplayName(input.displayName || input.serviceId)
  const staffMember = new StaffMemberEntity({
    id: randomUUID(),
    schoolId,
    firstName,
    lastName,
    accountKind: 'service',
    serviceId: input.serviceId,
    createdBySubjectId: actor.subjectId,
    serviceElevated: elevated,
    isActive: true,
  })

  const generated = input.apiKey
    ? encodeApiKey(input.apiKey)
    : generateApiKey()
  const serviceApiKey = new ServiceApiKey({
    id: randomUUID(),
    staffMemberId: staffMember.id,
    schoolId,
    keyPrefix: generated.prefix,
    keyHash: generated.hash,
    createdBySubjectId: actor.subjectId,
  })

  await repositories.staffMembers.save(staffMember)
  if (permissionAssignments.length > 0) {
    await saveServiceAccountPermissionAssignments(
      repositories,
      staffMember.id,
      schoolId,
      permissionAssignments,
    )
  }
  await repositories.serviceApiKeys.save(serviceApiKey)

  return {
    staffMember,
    apiKey: generated.plaintext,
  }
}

async function saveServiceAccountPermissionAssignments(
  repositories: AuthorizationRepositories,
  staffId: string,
  schoolId: string,
  permissionAssignments: readonly ServiceAccountPermissionAssignmentInput[],
): Promise<void> {
  for (const assignment of permissionAssignments) {
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: randomUUID(),
      staffId,
      schoolId,
      academicYearId: assignment.academicYearId,
      permission: assignment.permission,
      scopeIds: assignment.scopeIds,
      status: 'active',
    }))
  }
}

async function replaceServiceAccountPermissionAssignments(
  repositories: AuthorizationRepositories,
  staffId: string,
  schoolId: string,
  permissionAssignments: readonly ServiceAccountPermissionAssignmentInput[],
): Promise<void> {
  const existing = await repositories.staffPermissionAssignments.list({
    staffId,
    schoolId,
    status: 'active',
  })

  await Promise.all(
    existing
      .filter(assignment => !assignment.sourceStaffAssignmentId)
      .map(assignment => repositories.staffPermissionAssignments.delete(assignment.id)),
  )

  await saveServiceAccountPermissionAssignments(
    repositories,
    staffId,
    schoolId,
    permissionAssignments,
  )
}

function splitDisplayName(displayName: string): { firstName: string, lastName: string } {
  const [firstName, ...rest] = displayName.trim().split(/\s+/)
  return {
    firstName: firstName || 'Service',
    lastName: rest.join(' ') || 'Integration',
  }
}

export async function updateServiceAccount(
  repositories: AuthorizationRepositories,
  actor: StaffActorMetadata,
  staffMemberId: string,
  input: UpdateServiceAccountInput,
): Promise<StaffMember> {
  await operationModule(ServiceAccountOperations.update)(actor)

  if (
    input.displayName === undefined
    && input.permissionAssignments === undefined
  ) {
    throw new BusinessRuleViolationError(
      'SERVICE_ACCOUNT_UPDATE_EMPTY',
      'At least one field must be provided',
    )
  }

  const existing = await repositories.staffMembers.findById(staffMemberId)
  if (
    !existing
    || existing.schoolId !== actor.schoolId
    || existing.accountKind !== 'service'
    || !existing.isActive
  ) {
    throw new BusinessRuleViolationError(
      'SERVICE_ACCOUNT_NOT_FOUND',
      'Active service account not found for this school',
    )
  }

  if (input.permissionAssignments !== undefined) {
    assertDelegatedPermissionAssignmentsSubset(
      actor.effectiveGrants,
      input.permissionAssignments,
      actor.schoolId,
    )
    await replaceServiceAccountPermissionAssignments(
      repositories,
      staffMemberId,
      actor.schoolId,
      input.permissionAssignments,
    )
  }

  let updatedStaffMember = existing
  if (input.displayName !== undefined) {
    const { firstName, lastName } = splitDisplayName(input.displayName)
    updatedStaffMember = new StaffMemberEntity({
      id: existing.id,
      schoolId: existing.schoolId,
      firstName,
      lastName,
      email: existing.email,
      accountKind: existing.accountKind,
      serviceId: existing.serviceId,
      createdBySubjectId: existing.createdBySubjectId,
      serviceElevated: existing.serviceElevated,
      isActive: existing.isActive,
      createdAt: existing.createdAt,
    })
  }

  if (input.displayName !== undefined) {
    await repositories.staffMembers.save(updatedStaffMember)
  }

  return updatedStaffMember
}

export async function listServiceAccounts(
  repositories: AuthorizationRepositories,
  actor: StaffActorMetadata,
): Promise<StaffMember[]> {
  await operationModule(ServiceAccountOperations.read)(actor)
  return repositories.staffMembers.list({
    schoolId: actor.schoolId,
    accountKind: 'service',
  })
}

export async function revokeServiceAccount(
  repositories: AuthorizationRepositories,
  actor: StaffActorMetadata,
  staffMemberId: string,
): Promise<StaffMember> {
  await operationModule(ServiceAccountOperations.revoke)(actor)

  const existing = await repositories.staffMembers.findById(staffMemberId)
  if (!existing || existing.schoolId !== actor.schoolId || existing.accountKind !== 'service') {
    throw new BusinessRuleViolationError(
      'SERVICE_ACCOUNT_NOT_FOUND',
      'Service account not found for this school',
    )
  }

  const revoked = new StaffMemberEntity({
    id: existing.id,
    schoolId: existing.schoolId,
    firstName: existing.firstName,
    lastName: existing.lastName,
    email: existing.email,
    accountKind: existing.accountKind,
    serviceId: existing.serviceId,
    createdBySubjectId: existing.createdBySubjectId,
    serviceElevated: existing.serviceElevated,
    isActive: false,
    createdAt: existing.createdAt,
  })

  const keys = await repositories.serviceApiKeys.list({ staffMemberId: existing.id })
  const now = new Date()
  await repositories.staffMembers.save(revoked)
  for (const key of keys) {
    if (!key.revokedAt) {
      await repositories.serviceApiKeys.save(new ServiceApiKey({
        id: key.id,
        staffMemberId: key.staffMemberId,
        schoolId: key.schoolId,
        keyPrefix: key.keyPrefix,
        keyHash: key.keyHash,
        createdBySubjectId: key.createdBySubjectId,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        revokedAt: now,
        lastUsedAt: key.lastUsedAt,
      }))
    }
  }

  return revoked
}

export interface RotateServiceAccountKeyInput {
  /** When set, stores this key instead of generating a random one (dev/seeding only). */
  apiKey?: string
}

export async function rotateServiceAccountKey(
  repositories: AuthorizationRepositories,
  actor: StaffActorMetadata,
  staffMemberId: string,
  input: RotateServiceAccountKeyInput = {},
): Promise<{ apiKey: string }> {
  await operationModule(ServiceAccountOperations.rotateKey)(actor)

  const existing = await repositories.staffMembers.findById(staffMemberId)
  if (!existing || existing.schoolId !== actor.schoolId || existing.accountKind !== 'service' || !existing.isActive) {
    throw new BusinessRuleViolationError(
      'SERVICE_ACCOUNT_NOT_FOUND',
      'Active service account not found for this school',
    )
  }

  const keys = await repositories.serviceApiKeys.list({ staffMemberId: existing.id })
  const now = new Date()
  for (const key of keys) {
    if (!key.revokedAt) {
      await repositories.serviceApiKeys.save(new ServiceApiKey({
        id: key.id,
        staffMemberId: key.staffMemberId,
        schoolId: key.schoolId,
        keyPrefix: key.keyPrefix,
        keyHash: key.keyHash,
        createdBySubjectId: key.createdBySubjectId,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        revokedAt: now,
        lastUsedAt: key.lastUsedAt,
      }))
    }
  }

  const generated = input.apiKey
    ? encodeApiKey(input.apiKey)
    : generateApiKey()
  await repositories.serviceApiKeys.save(new ServiceApiKey({
    id: randomUUID(),
    staffMemberId: existing.id,
    schoolId: existing.schoolId,
    keyPrefix: generated.prefix,
    keyHash: generated.hash,
    createdBySubjectId: actor.subjectId,
  }))

  return { apiKey: generated.plaintext }
}
