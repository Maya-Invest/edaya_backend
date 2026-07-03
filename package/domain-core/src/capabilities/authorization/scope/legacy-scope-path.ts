import type { AuthorizationScopeType } from '../permissions/scope-type'

/** Maps legacy authorization request scope types to resource paths for path matching. */
export function legacyScopeToResourcePath(
  scopeType: AuthorizationScopeType,
  scopeEntityId: string,
): string {
  switch (scopeType) {
    case 'school':
    case 'academic_year':
    case 'platform':
      return ''
    case 'class_group':
    case 'grade_level':
    case 'student':
    case 'activity':
      return scopeEntityId
    case 'course_assignment':
    case 'class_subject':
    case 'subject':
    case 'grade_level_subject':
      return scopeEntityId
    case 'session':
      return scopeEntityId
    case 'student_group':
      return scopeEntityId
    default:
      return scopeEntityId
  }
}
