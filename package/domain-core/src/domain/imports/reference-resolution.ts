import { DayOfWeek } from '../scheduling/schedule'
import { BusinessRuleViolationError } from '../shared/business-rule-error'
import { foldReferenceCase } from '../shared/unicode-case-folding'
import { humanIdentifierSchema } from '../shared/visible-identification'

export interface ImportReferenceScope {
  schoolId: string
  entityType: string
  academicYearId?: string
  gradeLevelId?: string
  subjectId?: string
  weekday?: DayOfWeek
}

export interface ImportReferenceCandidate {
  id: string
  scope: ImportReferenceScope
  name?: string
  shortName?: string
  identifier?: string
  /** Supplied by authorization; hidden matches still prevent automatic resolution. */
  readable: boolean
}

export interface ImportReferenceAssertion {
  field: 'id' | 'identifier' | 'name' | 'shortName'
  value: string
}

export type ImportReferenceResolution
  = | { status: 'resolved', targetId: string, origin: 'automatic' | 'explicit' }
    | { status: 'unresolved' | 'ambiguous' | 'conflicting', candidates: ImportReferenceCandidate[] }

/** v2 readable reference equality; technical IDs never pass through this function. */
export function normalizeReferenceText(value: string): string {
  return foldReferenceCase(value.normalize('NFC').trim().replace(/[\p{Zs}\t]+/gu, ' ')).normalize('NFC')
}

function sameScope(candidate: ImportReferenceScope, scope: ImportReferenceScope): boolean {
  return candidate.schoolId === scope.schoolId && candidate.entityType === scope.entityType
    && (scope.academicYearId === undefined || candidate.academicYearId === scope.academicYearId)
    && (scope.gradeLevelId === undefined || candidate.gradeLevelId === scope.gradeLevelId)
    && (scope.subjectId === undefined || candidate.subjectId === scope.subjectId)
    && (scope.weekday === undefined || candidate.weekday === scope.weekday)
}

const annualTypes = new Set(['classGroups', 'academicPeriods', 'catalogServices', 'subjects', 'reportModules', 'periodDefinitions'])
const gradeTypes = new Set(['subjects', 'reportModules'])
const humanTypes = new Set(['students', 'teachers', 'guardians', 'staffMembers'])
const schoolTypes = new Set(['schools', 'gradeLevels', 'academicDisciplines', 'placementStatuses', 'subjectCategories', 'gradeScales', 'activities', 'disciplinaryActions', 'resources', 'staffPermissionProfiles', 'serviceAccounts', 'academicYears'])

export function validateImportReferenceScope(scope: ImportReferenceScope): void {
  if (!scope.schoolId.trim()
    || (!schoolTypes.has(scope.entityType) && !annualTypes.has(scope.entityType) && !humanTypes.has(scope.entityType) && scope.entityType !== 'subjectMatters')
    || (annualTypes.has(scope.entityType) && !scope.academicYearId?.trim())
    || (gradeTypes.has(scope.entityType) && !scope.gradeLevelId?.trim())
    || (scope.entityType === 'subjectMatters' && !scope.subjectId?.trim())
    || (scope.entityType === 'periodDefinitions' && !Object.values(DayOfWeek).includes(scope.weekday!))) {
    throw new BusinessRuleViolationError('IMPORT_REFERENCE_SCOPE_REQUIRED', 'The reference requires its complete school and parent scope')
  }
}

/**
 * Callers supply the complete scoped candidate set, including unreadable matches.
 * Persisted and staged versions of the same ID must already represent one proposed state.
 * This resolver handles relationships only, never selection of a row's update target.
 */
export function resolveImportReference(input: {
  scope: ImportReferenceScope
  assertions: readonly ImportReferenceAssertion[]
  candidates: readonly ImportReferenceCandidate[]
  selectedId?: string
}): ImportReferenceResolution {
  validateImportReferenceScope(input.scope)
  if (!input.assertions.length || input.assertions.some(assertion => !assertion.value.trim()))
    throw new BusinessRuleViolationError('IMPORT_REFERENCE_REQUIRED', 'A nonblank reference is required')
  if (input.scope.entityType === 'schools' && input.assertions.some(assertion => assertion.field !== 'id'))
    throw new BusinessRuleViolationError('IMPORT_SCHOOL_ID_REQUIRED', 'Select a school by its internal ID')
  if (input.assertions.some(assertion => humanTypes.has(input.scope.entityType)
    ? assertion.field === 'name' || assertion.field === 'shortName'
    : assertion.field === 'identifier')) {
    throw new BusinessRuleViolationError('IMPORT_REFERENCE_FIELD_INVALID', 'Use a human identifier or a non-human name/short name, or an internal ID')
  }

  const candidates = [...new Map(input.candidates.filter(candidate => sameScope(candidate.scope, input.scope)).map(candidate => [candidate.id, candidate])).values()]
  const matches = input.assertions.map((assertion) => {
    const normalize = assertion.field === 'identifier'
      ? (value: string) => humanIdentifierSchema.parse(value)
      : assertion.field === 'id' ? (value: string) => value : normalizeReferenceText
    const expected = normalize(assertion.value)
    return candidates.filter((candidate) => {
      const actual = candidate[assertion.field]
      return actual !== undefined && normalize(actual) === expected
    })
  })
  if (matches.some(group => !group.length))
    return { status: 'unresolved', candidates: [] }
  const agreed = candidates.filter(candidate => matches.every(group => group.some(match => match.id === candidate.id)))
  if (!agreed.length)
    return { status: 'conflicting', candidates: [] }
  if (input.selectedId !== undefined) {
    const selected = agreed.find(candidate => candidate.id === input.selectedId && candidate.readable)
    return selected
      ? { status: 'resolved', targetId: selected.id, origin: 'explicit' }
      : { status: 'unresolved', candidates: [] }
  }
  if (agreed.length === 1) {
    const only = agreed[0]!
    return only.readable
      ? { status: 'resolved', targetId: only.id, origin: input.assertions.some(assertion => assertion.field === 'id') ? 'explicit' : 'automatic' }
      : { status: 'unresolved', candidates: [] }
  }
  return { status: 'ambiguous', candidates: agreed.filter(candidate => candidate.readable) }
}
