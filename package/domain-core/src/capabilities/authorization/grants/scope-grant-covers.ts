import type { ScopeGrant } from '../model/scope-grant'
import type { Permission } from '../permissions/permission'
import type { ScopeType } from '../permissions/scope-type'

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

  const hasSchoolGrant = grants.some(grant =>
    grant.permission === args.permission
    && grant.scopeType === 'school'
    && (grant.scopeEntityIds.length === 0 || grant.scopeEntityIds.includes(args.schoolId)),
  )
  if (hasSchoolGrant) {
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

  return matching.some(grant => grant.scopeEntityIds.includes(args.scopeEntityId!))
}
