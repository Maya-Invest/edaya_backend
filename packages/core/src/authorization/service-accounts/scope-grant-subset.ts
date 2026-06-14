import type { EffectiveGrants } from '../model/effective-grants'
import type { ScopeGrant } from '../model/scope-grant'

export function scopeGrantSubsetCovers(
  creatorGrants: EffectiveGrants,
  requested: ScopeGrant,
  schoolId: string,
): boolean {
  const schoolWide = creatorGrants.scopeGrants.some(grant =>
    grant.permission === requested.permission
    && grant.scopeType === 'school'
    && (grant.scopeEntityIds.length === 0 || grant.scopeEntityIds.includes(schoolId)),
  )
  if (schoolWide) {
    return true
  }

  const creatorGrant = creatorGrants.scopeGrants.find(grant =>
    grant.permission === requested.permission
    && grant.scopeType === requested.scopeType,
  )
  if (!creatorGrant) {
    return false
  }

  if (requested.scopeEntityIds.length === 0) {
    return true
  }

  return requested.scopeEntityIds.every(id => creatorGrant.scopeEntityIds.includes(id))
}
