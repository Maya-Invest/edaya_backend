import type { EffectiveGrants } from '../model/effective-grants'
import type { ScopeGrant } from '../model/scope-grant'
import type { Permission } from '../permissions/permission'
import type { AuthorizationScopeType } from '../permissions/scope-type'
import { permissionDefinitions } from '../permissions/permission-definitions'
import { legacyScopeToResourcePath } from '../scope/legacy-scope-path'
import { scopePathCovers } from '../scope/scope-path-covers'

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

function isLegacyScopeGrantList(
  grants: EffectiveGrants | readonly ScopeGrant[],
): grants is readonly ScopeGrant[] {
  return Array.isArray(grants)
}

export function scopeGrantCovers(
  grants: EffectiveGrants | readonly ScopeGrant[],
  args: {
    permission: Permission
    schoolId: string
    scopeType?: AuthorizationScopeType
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

  if (!isLegacyScopeGrantList(grants)) {
    const scopeIds = grants.scopeIdsByPermission?.[args.permission]
    if (scopeIds !== undefined) {
      const definition = permissionDefinitions[args.permission]
      if (!definition.scope) {
        if (!args.scopeType || args.scopeEntityId === undefined) {
          return true
        }
        if (args.scopeType === 'school') {
          return true
        }
        return false
      }
      if (!args.scopeEntityId) {
        return true
      }
      const resourcePath = legacyScopeToResourcePath(args.scopeType, args.scopeEntityId)
      return scopePathCovers(scopeIds, resourcePath, definition.scope)
    }
  }

  const scopeGrants: readonly ScopeGrant[] = isLegacyScopeGrantList(grants) ? grants : grants.scopeGrants

  const hasSchoolGrant = scopeGrants.some((grant: ScopeGrant) =>
    grant.permission === args.permission
    && grant.scopeType === 'school'
    && (grant.scopeEntityIds.length === 0 || grant.scopeEntityIds.includes(args.schoolId)),
  )
  if (hasSchoolGrant) {
    return true
  }

  const matching = scopeGrants.filter(grant =>
    grant.permission === args.permission && grant.scopeType === args.scopeType)

  if (matching.length === 0) {
    return false
  }

  if (!args.scopeEntityId) {
    return true
  }

  return matching.some(grant => grant.scopeEntityIds.includes(args.scopeEntityId!))
}
