import type { AuthorizationScopeType, ScopeType } from '../permissions/scope-type'

const CATALOG_TO_REQUEST_SCOPES: Record<ScopeType, readonly AuthorizationScopeType[]> = {
  grade_level: ['grade_level'],
  grade_level_subject: ['grade_level_subject'],
  class_group: ['class_group'],
  class_subject: ['class_subject', 'course_assignment', 'class_group', 'session'],
  activity: ['activity', 'session'],
  student: ['student'],
  platform: ['platform'],
}

export function requestScopeAllowedForCatalogScope(
  catalogScope: ScopeType | undefined,
  requestScope: AuthorizationScopeType,
): boolean {
  if (!catalogScope) {
    return requestScope === 'school' || requestScope === 'academic_year'
  }

  // Legacy school-wide scope requests remain valid while routes still emit them.
  if (requestScope === 'school' || requestScope === 'academic_year') {
    return true
  }

  return CATALOG_TO_REQUEST_SCOPES[catalogScope].includes(requestScope)
}
