import type { ScopeGrant } from '../../authorization'
import type { StaffActorMetadata } from '../../authorization/model/actor'
import type { StaffMember } from '../../domains'
import type { SchoolRepositories } from '../../ports'
import { randomUUID } from 'node:crypto'
import {
  assertDelegatedPermissionsSubset,
  assertDelegatedScopeGrantsSubset,
  assertOwnerServiceAccountAllowed,
  generateApiKey,
  Permission,
} from '../../authorization'
import { ServiceApiKey, StaffMember as StaffMemberEntity, StaffRoleAssignment } from '../../domains'
import { permissionAction } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'

export interface CreateServiceAccountInput {
  serviceId: string
  displayName: string
  roleIds: readonly string[]
  scopeGrants?: readonly ScopeGrant[]
  elevated?: boolean
}

export interface CreateServiceAccountResult {
  staffMember: StaffMember
  apiKey: string
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

  const roles = await repositories.accessRoles.findByIds([...input.roleIds])
  if (roles.length !== input.roleIds.length || roles.some(role => role.schoolId !== schoolId)) {
    throw new BusinessRuleViolationError(
      'SERVICE_ACCOUNT_ROLE_NOT_FOUND',
      'One or more access roles are missing for this school',
    )
  }

  const requestedPermissions = [...new Set(roles.flatMap(role => [...role.permissions]))]
  assertDelegatedPermissionsSubset(actor.effectiveGrants, requestedPermissions)
  assertDelegatedScopeGrantsSubset(
    actor.effectiveGrants,
    input.scopeGrants ?? [],
    schoolId,
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

  const [firstName, ...rest] = input.displayName.trim().split(/\s+/)
  const staffMember = new StaffMemberEntity({
    id: randomUUID(),
    schoolId,
    firstName: firstName || input.serviceId,
    lastName: rest.join(' ') || 'Integration',
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

  const generated = generateApiKey()
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
