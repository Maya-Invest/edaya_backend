import type { ScopeType } from '../permissions/scope-type'
import { parseScopeIds } from './scope-ids-parse'
import { pathCoversResource } from './scope-path-match'

/**
 * Returns whether `grantScopeIds` covers `resourcePath` for a permission with optional catalog scope.
 *
 * `resourcePath` uses `:` hierarchy (e.g. `classGroupId:classSubjectId`). When only a leaf id is
 * known (legacy `course_assignment` requests), pass a single-segment path.
 */
export function scopePathCovers(
  grantScopeIds: string,
  resourcePath: string,
  permissionScope?: ScopeType,
): boolean {
  if (grantScopeIds === '') {
    return permissionScope === undefined
  }

  if (!permissionScope) {
    return false
  }

  const grant = parseScopeIds(grantScopeIds)
  const resourceSegments = resourcePath === ''
    ? []
    : resourcePath.split(':').map(segment => segment.trim()).filter(Boolean)

  if (resourceSegments.length === 0) {
    return grant.clauses.length > 0
  }

  return grant.clauses.some(clause =>
    clause.paths.some(path => pathCoversResource(path, resourceSegments)),
  )
}
