import type { StaffRole } from '../entities/school/staff-member'
import type { SchoolRepositories } from '../ports/school-repositories'
import type { Permission } from './permissions/permission'
import type { ScopeType } from './permissions/scope-type'
import type { ScopeGrant } from './role-types'
import { tryResolveEffectiveGrantsFromPersistence } from './access-control/resolve-persisted-grants'
import { AuthorizationError, AuthorizationErrorCode } from './authorization-error'

export interface EffectiveGrants {
  readonly permissions: ReadonlySet<Permission>
  readonly scopeGrants: readonly ScopeGrant[]
  /** Admin / Principal: school-wide access without per-entity scope grants. */
  readonly isElevated: boolean
  /** Earliest grant expiry represented in this grant set, used to bound caches. */
  readonly expiresAt?: Date
}

export interface ResolveEffectiveGrantsArgs {
  staffMemberId: string
  schoolId: string
  repositories: SchoolRepositories
  academicYearId?: string
  now?: Date
  fallbackRoles?: readonly StaffRole[]
}

export async function resolveEffectiveGrants(
  args: ResolveEffectiveGrantsArgs,
): Promise<EffectiveGrants> {
  const persisted = await tryResolveEffectiveGrantsFromPersistence(args)
  if (persisted) {
    return persisted
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

export function mergeScopeGrants(grants: readonly ScopeGrant[]): ScopeGrant[] {
  const merged = new Map<string, ScopeGrant>()

  for (const grant of grants) {
    const key = `${grant.permission}:${grant.scopeType}`
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, {
        permission: grant.permission,
        scopeType: grant.scopeType,
        scopeEntityIds: [...grant.scopeEntityIds],
      })
      continue
    }

    merged.set(key, {
      ...existing,
      scopeEntityIds: [...new Set([...existing.scopeEntityIds, ...grant.scopeEntityIds])],
    })
  }

  return [...merged.values()]
}

export function scopeGrantCovers(
  grants: readonly ScopeGrant[],
  args: {
    permission: Permission
    schoolId: string
    scopeType?: ScopeType
    scopeEntityId?: string
    isElevated: boolean
  },
): boolean {
  if (args.isElevated) {
    return true
  }

  if (!args.scopeType) {
    return true
  }

  const matching = grants.filter(grant =>
    grant.permission === args.permission && grant.scopeType === args.scopeType)

  if (matching.length === 0) {
    return false
  }

  if (!args.scopeEntityId) {
    return true
  }

  return matching.some((grant) => {
    if (grant.scopeType === 'school') {
      return grant.scopeEntityIds.length === 0 || grant.scopeEntityIds.includes(args.schoolId)
    }
    return grant.scopeEntityIds.includes(args.scopeEntityId!)
  })
}
