import type { EffectiveGrants } from '../model/effective-grants'
import type { ScopeGrant } from '../model/scope-grant'
import type { Permission } from '../permissions/permission'
import { permissionDefinitions } from '../permissions/permission-definitions'
import { parseScopeIds } from '../scope/scope-ids-parse'
import { scopePathCovers } from '../scope/scope-path-covers'
import { scopeGrantSubsetCovers } from './scope-grant-subset'

export interface DelegatedPermissionAssignment {
  readonly permission: Permission
  readonly scopeIds: string
}

function legacyScopeGrantsCoverRequestedScopeIds(
  creatorGrants: EffectiveGrants,
  permission: Permission,
  requestedScopeIds: string,
  schoolId: string,
): boolean {
  if (requestedScopeIds === '') {
    return creatorGrants.scopeGrants.some(grant =>
      grant.permission === permission
      && grant.scopeType === 'school'
      && (grant.scopeEntityIds.length === 0 || grant.scopeEntityIds.includes(schoolId)),
    )
  }

  const catalogScope = permissionDefinitions[permission].scope
  const parsed = parseScopeIds(requestedScopeIds)

  return parsed.clauses.every(clause =>
    clause.paths.every((path) => {
      const resourcePath = path.segments
        .filter(segment => segment !== '*')
        .join(':')

      if (resourcePath === '') {
        return true
      }

      const legacyGrant: ScopeGrant = {
        permission,
        scopeType: catalogScope === 'class_group'
          ? 'class_group'
          : catalogScope === 'class_subject'
            ? 'course_assignment'
            : catalogScope === 'student'
              ? 'student'
              : 'school',
        scopeEntityIds: resourcePath.includes(':')
          ? [resourcePath.split(':').at(-1)!]
          : [resourcePath],
      }

      return scopeGrantSubsetCovers(creatorGrants, legacyGrant, schoolId)
    }),
  )
}

export function delegatedPermissionAssignmentSubsetCovers(
  creatorGrants: EffectiveGrants,
  requested: DelegatedPermissionAssignment,
  schoolId: string,
): boolean {
  if (creatorGrants.isElevated) {
    return true
  }

  if (!creatorGrants.permissions.has(requested.permission)) {
    return false
  }

  const creatorScopeIds = creatorGrants.scopeIdsByPermission?.[requested.permission]
  const catalogScope = permissionDefinitions[requested.permission].scope

  if (creatorScopeIds !== undefined) {
    if (requested.scopeIds === '') {
      return creatorScopeIds === ''
    }

    const parsed = parseScopeIds(requested.scopeIds)
    return parsed.clauses.every(clause =>
      clause.paths.every((path) => {
        const resourcePath = path.segments
          .filter(segment => segment !== '*')
          .join(':')
        return scopePathCovers(creatorScopeIds, resourcePath, catalogScope)
      }),
    )
  }

  return legacyScopeGrantsCoverRequestedScopeIds(
    creatorGrants,
    requested.permission,
    requested.scopeIds,
    schoolId,
  )
}
