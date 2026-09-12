import type { GrantScope } from '../../domain/permissions/grant-scope'
import type { CoreEntityKey } from '../../registry/core-entity-map'

/** A policy-produced constraint. Clients cannot supply repository access scopes. */
export type AccessTarget = GrantScope
  | { readonly kind: 'records', readonly ids: readonly string[] }
  | { readonly kind: 'recipient', readonly actorKind: 'staff' | 'teacher' | 'guardian' | 'student', readonly actorId: string }
  | { readonly kind: 'audience', readonly actorKind: 'teacher' | 'guardian' | 'student', readonly actorId: string, readonly studentIds: readonly string[], readonly classGroupIds: readonly string[] }

export interface ResourceAccessClause {
  readonly target: AccessTarget
  readonly academicYearId?: string
  readonly publishedOnly?: boolean
  readonly noteVisibility?: 'staff' | 'guardian'
  readonly authorStaffId?: string
  readonly attendanceMode?: 'session' | 'daily'
}

/** Alternatives are additive; every condition inside one alternative is required. */
export interface ResourceAccessScope {
  readonly schoolId: string
  readonly resource: CoreEntityKey
  readonly clauses: readonly ResourceAccessClause[]
}

export function resourceAccessScope(
  schoolId: string,
  resource: CoreEntityKey,
  clauses: readonly ResourceAccessClause[],
): ResourceAccessScope {
  if (!schoolId.trim())
    throw new Error('An access scope requires a trusted school')
  return Object.freeze({ schoolId, resource, clauses: Object.freeze(clauses.map(clause => Object.freeze(clause))) })
}
