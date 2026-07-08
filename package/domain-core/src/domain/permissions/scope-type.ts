/** Staff grant tree scopes (persisted in `StaffPermissionAssignment.scopeIds`). */
export type StaffGrantScopeType
  = | 'grade_level'
    | 'grade_level_subject'
    | 'class_group'
    | 'class_subject'
    | 'activity'

/** Portal computed grants (single-segment `studentId` paths). */
export type PortalScopeType = 'student'

/** Platform bootstrap only (`PLATFORM_REGISTER_SCHOOL`). */
export type PlatformScopeType = 'platform'

/** Scope grain declared on the permission catalog. */
export type ScopeType = StaffGrantScopeType | PortalScopeType | PlatformScopeType

/**
 * Legacy scope dimensions used by `StaffRoleAssignment.scopeGrants` and
 * `AuthorizationRequest` during migration. Removed from staff grants in the target model.
 */
export type LegacyScopeType
  = | 'platform'
    | 'school'
    | 'academic_year'
    | 'class_group'
    | 'subject'
    | 'course_assignment'
    | 'session'
    | 'student'
    | 'student_group'

/** Scope type on an authorization request (catalog + legacy during cutover). */
export type AuthorizationScopeType = ScopeType | LegacyScopeType
