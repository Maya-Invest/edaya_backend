import type { ActorMetadata } from './actor-metadata'

export type AuthorizationAction
  = 'setup.manage'
    | 'setup.assign_staff'
    | 'academics.manage_curriculum'
    | 'academics.record_progress'
    | 'scheduling.manage'
    | 'attendance.record'
    | 'assessments.manage_configuration'
    | 'assessments.record_grade'
    | 'assessments.publish_report_card'
    | 'students.manage_enrollment'
    | 'students.manage_guardians'
    | 'finance.manage'
    | 'communications.manage'
    | 'queries.read_school'
    | 'queries.read_student'
    | 'queries.read_guardian_self'

export interface AuthorizationResourceContext {
  readonly schoolId: string
  readonly academicYearId?: string
  readonly classGroupId?: string
  readonly classSubjectId?: string
  readonly sessionId?: string
  readonly studentId?: string
  readonly guardianId?: string
  readonly reportCardResultId?: string
  readonly studentFeeId?: string
  readonly announcementId?: string
}

export interface AuthorizationRequest {
  readonly action: AuthorizationAction
  readonly resource: AuthorizationResourceContext
}

/**
 * Evaluates actor access after a service has resolved the resource context
 * required by its use case. Implementations may consult current repository
 * relationships such as staff assignments or guardian/student links.
 */
export interface AuthorizationPolicy {
  requirePermission: (actor: ActorMetadata, request: AuthorizationRequest) => Promise<void>
}
