import type { ScopeGrant } from '../'
import type { StaffMember } from '../../../domain'
import type { SchoolRepositories } from '../../../ports'
import type { StaffActorMetadata } from '../model/actor'
import { randomUUID } from 'node:crypto'
import {
  assertDelegatedPermissionsSubset,
  assertDelegatedScopeGrantsSubset,
  assertOwnerServiceAccountAllowed,
  encodeApiKey,
  generateApiKey,
  Permission,
} from '../'
import { permissionAction } from '../../../application/entities/entity-config'
import { ServiceApiKey, StaffMember as StaffMemberEntity, StaffRoleAssignment } from '../../../domain'
import { BusinessRuleViolationError } from '../../../domain/shared/business-rule-error'

export interface CreateServiceAccountInput {
  serviceId: string
  displayName: string
  roleIds: readonly string[]
  scopeGrants?: readonly ScopeGrant[]
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
  roleIds?: readonly string[]
  scopeGrants?: readonly ScopeGrant[]
}

export async function createServiceAccount(
  repositories: SchoolRepositories,
  actor: StaffActorMetadata,
  input: CreateServiceAccountInput,
): Promise<CreateServiceAccountResult> {
  await permissionAction(Permission.SERVICE_ACCOUNT_CREATE)(actor)

  const schoolId = actor.schoolId
  const elevated = input.elevated ?? false
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

  await assertServiceAccountRoleDelegation(
    repositories,
    actor,
    schoolId,
    input.roleIds,
    input.scopeGrants ?? [],
  )

  const existingService = await repositories.staffMembers.findOne({
    schoolId,
    accountKind: 'service',
    serviceId: input.serviceId,
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

  const staffRoleAssignment = new StaffRoleAssignment({
    id: randomUUID(),
    staffId: staffMember.id,
    schoolId,
    roleIds: [...input.roleIds],
    scopeGrants: [...(input.scopeGrants ?? [])],
    status: 'active',
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
  await repositories.staffRoleAssignments.save(staffRoleAssignment)
  await repositories.serviceApiKeys.save(serviceApiKey)

  return {
    staffMember,
    apiKey: generated.plaintext,
  }
}

async function assertServiceAccountRoleDelegation(
  repositories: SchoolRepositories,
  actor: StaffActorMetadata,
  schoolId: string,
  roleIds: readonly string[],
  scopeGrants: readonly ScopeGrant[],
): Promise<void> {
  const roles = await repositories.accessRoles.findByIds([...roleIds])
  if (roles.length !== roleIds.length || roles.some(role => role.schoolId !== schoolId)) {
    throw new BusinessRuleViolationError(
      'SERVICE_ACCOUNT_ROLE_NOT_FOUND',
      'One or more access roles are missing for this school',
    )
  }

  const requestedPermissions = [...new Set(roles.flatMap(role => [...role.permissions]))]
  assertDelegatedPermissionsSubset(actor.effectiveGrants, requestedPermissions)
  assertDelegatedScopeGrantsSubset(actor.effectiveGrants, scopeGrants, schoolId)
}

function splitDisplayName(displayName: string): { firstName: string, lastName: string } {
  const [firstName, ...rest] = displayName.trim().split(/\s+/)
  return {
    firstName: firstName || 'Service',
    lastName: rest.join(' ') || 'Integration',
  }
}

export async function updateServiceAccount(
  repositories: SchoolRepositories,
  actor: StaffActorMetadata,
  staffMemberId: string,
  input: UpdateServiceAccountInput,
): Promise<StaffMember> {
  await permissionAction(Permission.SERVICE_ACCOUNT_UPDATE)(actor)

  if (
    input.displayName === undefined
    && input.roleIds === undefined
    && input.scopeGrants === undefined
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

  const assignments = await repositories.staffRoleAssignments.list({
    staffId: staffMemberId,
    schoolId: actor.schoolId,
    status: 'active',
  })
  const activeAssignment = assignments[0]
  if (!activeAssignment) {
    throw new BusinessRuleViolationError(
      'SERVICE_ACCOUNT_NOT_FOUND',
      'Active service account not found for this school',
    )
  }

  const nextRoleIds = input.roleIds ?? activeAssignment.roleIds
  const nextScopeGrants = input.scopeGrants ?? activeAssignment.scopeGrants

  if (input.roleIds !== undefined || input.scopeGrants !== undefined) {
    await assertServiceAccountRoleDelegation(
      repositories,
      actor,
      actor.schoolId,
      nextRoleIds,
      nextScopeGrants,
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

  if (input.roleIds !== undefined || input.scopeGrants !== undefined) {
    const updatedAssignment = new StaffRoleAssignment({
      id: activeAssignment.id,
      staffId: activeAssignment.staffId,
      schoolId: activeAssignment.schoolId,
      academicYearId: activeAssignment.academicYearId,
      roleIds: [...nextRoleIds],
      scopeGrants: [...nextScopeGrants],
      status: activeAssignment.status,
      startsAt: activeAssignment.startsAt,
      endsAt: activeAssignment.endsAt,
      createdAt: activeAssignment.createdAt,
    })
    await repositories.staffRoleAssignments.save(updatedAssignment)
  }

  if (input.displayName !== undefined) {
    await repositories.staffMembers.save(updatedStaffMember)
  }

  return updatedStaffMember
}

export async function listServiceAccounts(
  repositories: SchoolRepositories,
  actor: StaffActorMetadata,
): Promise<StaffMember[]> {
  await permissionAction(Permission.SERVICE_ACCOUNT_READ)(actor)
  return repositories.staffMembers.list({
    schoolId: actor.schoolId,
    accountKind: 'service',
  })
}

export async function revokeServiceAccount(
  repositories: SchoolRepositories,
  actor: StaffActorMetadata,
  staffMemberId: string,
): Promise<StaffMember> {
  await permissionAction(Permission.SERVICE_ACCOUNT_REVOKE)(actor)

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

export async function rotateServiceAccountKey(
  repositories: SchoolRepositories,
  actor: StaffActorMetadata,
  staffMemberId: string,
): Promise<{ apiKey: string }> {
  await permissionAction(Permission.SERVICE_ACCOUNT_ROTATE_KEY)(actor)

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

  const generated = generateApiKey()
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
