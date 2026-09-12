import type { AtomicExecutionPort, GrantScope, StaffMember } from '@edaya/core'
import { randomUUID } from 'node:crypto'
import { BusinessRuleViolationError, Permission, ServiceApiKey, StaffMember as StaffMemberEntity, StaffPermissionAssignment } from '@edaya/core'
import type { StaffActorMetadata } from '../model/actor'
import type { AuthorizationRepositories } from '../ports/authorization-repositories'
import { AccessPolicies } from '../access/access-policies'
import { AccessFacts, denied } from '../access/facts'
import { assertGrantDelegation } from '../access/grant-administration'
import { encodeApiKey, generateApiKey } from './api-key-crypto'

export interface ServiceAccountPermissionAssignmentInput {
  permission: Permission
  scopes: GrantScope[]
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

async function performCreateServiceAccount(
  repositories: AuthorizationRepositories,
  actor: StaffActorMetadata,
  input: CreateServiceAccountInput,
): Promise<CreateServiceAccountResult> {
  await new AccessPolicies(actor, repositories).assertSchool(Permission.SERVICE_ACCOUNT_CREATE)

  const schoolId = actor.schoolId
  const elevated = input.elevated ?? false
  const permissionAssignments = input.permissionAssignments ?? []
  if (elevated && !await new AccessFacts(actor, repositories).owner()) denied('Only a school owner can create an owner service account')

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
    await assertGrantDelegation(new AccessFacts(actor, repositories), permissionAssignments)
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
      scopes: assignment.scopes,
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
    existing.map(assignment => repositories.staffPermissionAssignments.delete(assignment.id)),
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

async function performUpdateServiceAccount(
  repositories: AuthorizationRepositories,
  actor: StaffActorMetadata,
  staffMemberId: string,
  input: UpdateServiceAccountInput,
): Promise<StaffMember> {
  await new AccessPolicies(actor, repositories).assertSchool(Permission.SERVICE_ACCOUNT_UPDATE)

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
    await assertGrantDelegation(new AccessFacts(actor, repositories), input.permissionAssignments)
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
  await new AccessPolicies(actor, repositories).assertSchool(Permission.SERVICE_ACCOUNT_READ)
  return repositories.staffMembers.list({
    schoolId: actor.schoolId,
    accountKind: 'service',
  })
}

async function performRevokeServiceAccount(
  repositories: AuthorizationRepositories,
  actor: StaffActorMetadata,
  staffMemberId: string,
): Promise<StaffMember> {
  await new AccessPolicies(actor, repositories).assertSchool(Permission.SERVICE_ACCOUNT_REVOKE)

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

async function performRotateServiceAccountKey(
  repositories: AuthorizationRepositories,
  actor: StaffActorMetadata,
  staffMemberId: string,
  input: RotateServiceAccountKeyInput = {},
): Promise<{ apiKey: string }> {
  await new AccessPolicies(actor, repositories).assertSchool(Permission.SERVICE_ACCOUNT_ROTATE_KEY)

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

/** Each command reads its authority and changes its facts within the same transaction. */
export function createServiceAccount(repositories: AuthorizationRepositories, actor: StaffActorMetadata, input: CreateServiceAccountInput, atomicExecution: AtomicExecutionPort): Promise<CreateServiceAccountResult> {
  return atomicExecution.execute(() => performCreateServiceAccount(repositories, actor, input), { lockKeys: [`service-accounts:${actor.schoolId}`] })
}

export function updateServiceAccount(repositories: AuthorizationRepositories, actor: StaffActorMetadata, id: string, input: UpdateServiceAccountInput, atomicExecution: AtomicExecutionPort): Promise<StaffMember> {
  return atomicExecution.execute(() => performUpdateServiceAccount(repositories, actor, id, input), { lockKeys: [`service-accounts:${actor.schoolId}`] })
}

export function revokeServiceAccount(repositories: AuthorizationRepositories, actor: StaffActorMetadata, id: string, atomicExecution: AtomicExecutionPort): Promise<StaffMember> {
  return atomicExecution.execute(() => performRevokeServiceAccount(repositories, actor, id), { lockKeys: [`service-accounts:${actor.schoolId}`] })
}

export function rotateServiceAccountKey(repositories: AuthorizationRepositories, actor: StaffActorMetadata, id: string, input: RotateServiceAccountKeyInput, atomicExecution: AtomicExecutionPort): Promise<{ apiKey: string }> {
  return atomicExecution.execute(() => performRotateServiceAccountKey(repositories, actor, id, input), { lockKeys: [`service-accounts:${actor.schoolId}`] })
}
