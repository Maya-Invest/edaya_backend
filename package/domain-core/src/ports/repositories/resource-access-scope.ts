import type { AuthorityScope } from '../../domain/permissions/authority-scope'
import type { AttachmentOwnerKind } from '../../domain/school/attachment'
import type { CoreEntityKey } from '../../registry/core-entity-map'
import { GENERAL_ATTACHMENT_PURPOSE } from '../../domain/school/attachment'

/** A policy-produced constraint. Clients cannot supply repository access scopes. */
export type AccessTarget = AuthorityScope
  | { readonly kind: 'records', readonly ids: readonly string[] }
  | { readonly kind: 'recipient', readonly actorKind: 'staff' | 'teacher' | 'guardian' | 'student', readonly actorId: string, readonly subjectId: string }
  | { readonly kind: 'audience', readonly actorKind: 'staff' | 'teacher' | 'guardian' | 'student', readonly actorId: string, readonly classGroupIds: readonly string[] }

export interface ResourceAccessClause {
  readonly target: AccessTarget
  readonly academicYearId?: string
  /** Read-only calendar context includes school and grade events affecting a visible class. */
  readonly calendarAncestors?: boolean
  readonly publishedOnly?: boolean
  readonly attachmentOwners?: readonly AttachmentOwnerKind[]
  /** Exact purposes selected by the named policy. Generic scopes default to general only. */
  readonly attachmentPurposes?: readonly string[]
  /** Exact attachment identities selected by a named policy. */
  readonly attachmentIds?: readonly string[]
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
  return Object.freeze({ schoolId, resource, clauses: Object.freeze(clauses.map(clause => Object.freeze(resource === 'attachments'
    ? { ...clause, attachmentPurposes: Object.freeze([...(clause.attachmentPurposes ?? [GENERAL_ATTACHMENT_PURPOSE])]) }
    : clause))) })
}
