import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from './actor-metadata'
import { StaffRole } from '../../entities/school/staff-member'
import { StudentStatus } from '../../entities/students/student'
import { AuthorizationError, AuthorizationErrorCode } from './authorization-error'

export type AuthorizationAction
  = 'setup.register_school'
    | 'setup.manage'
    | 'setup.manage_lifecycle'
    | 'setup.assign_staff'
    | 'academics.manage_curriculum'
    | 'academics.record_progress'
    | 'academics.read_progress'
    | 'scheduling.manage'
    | 'attendance.record'
    | 'attendance.review_justification'
    | 'attendance.read'
    | 'behavior.report_incident'
    | 'behavior.manage_discipline'
    | 'behavior.read_incidents'
    | 'resources.manage'
    | 'resources.read'
    | 'attachments.manage'
    | 'attachments.read'
    | 'assessments.manage_configuration'
    | 'assessments.record_result'
    | 'assessments.read_results'
    | 'assessments.publish_report_card'
    | 'students.manage_enrollment'
    | 'students.manage_guardians'
    | 'students.manage_profile'
    | 'students.manage_health'
    | 'students.manage_notes'
    | 'finance.manage'
    | 'finance.read'
    | 'communications.manage'
    | 'queries.read_workspace'
    | 'queries.read_overview'
    | 'queries.read_student_directory'
    | 'queries.read_student_detail'
    | 'queries.read_enrollment_history'
    | 'queries.read_report_card_detail'
    | 'queries.read_communications'
    | 'queries.read_calendar'
    | 'queries.read_curriculum_progress'
    | 'queries.read_class_directory'
    | 'queries.read_class_curriculum'
    | 'queries.read_timetable'
    | 'queries.read_attendance'
    | 'queries.read_guardian_students_admin'
    | 'queries.read_guardian_self'
    | 'query.get_overdue_fees'

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
  readonly resourceId?: string
  readonly attachmentId?: string
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

export interface AuthorizedServiceArgs {
  actor: ActorMetadata
  authorizationPolicy: AuthorizationPolicy
}

export interface RepositoryAuthorizationPolicyArgs {
  staffAssignmentRepository: SchoolRepositories['staffAssignments']
  staffMemberRepository: SchoolRepositories['staffMembers']
  guardianRepository: SchoolRepositories['guardians']
  guardianStudentLinkRepository: SchoolRepositories['guardianLinks']
  studentRepository: SchoolRepositories['students']
}

const elevatedRoles = new Set([StaffRole.Admin, StaffRole.Principal])

const coordinatorActions = new Set<AuthorizationAction>([
  'academics.manage_curriculum',
  'setup.manage_lifecycle',
  'academics.record_progress',
  'academics.read_progress',
  'scheduling.manage',
  'attendance.record',
  'attendance.review_justification',
  'attendance.read',
  'behavior.report_incident',
  'behavior.manage_discipline',
  'behavior.read_incidents',
  'resources.manage',
  'resources.read',
  'attachments.manage',
  'attachments.read',
  'assessments.manage_configuration',
  'assessments.record_result',
  'assessments.read_results',
  'assessments.publish_report_card',
  'students.manage_enrollment',
  'students.manage_guardians',
  'students.manage_profile',
  'students.manage_health',
  'students.manage_notes',
  'communications.manage',
  'queries.read_workspace',
  'queries.read_student_detail',
  'queries.read_enrollment_history',
  'queries.read_report_card_detail',
  'queries.read_communications',
  'queries.read_calendar',
  'queries.read_curriculum_progress',
  'queries.read_class_directory',
  'queries.read_class_curriculum',
  'queries.read_timetable',
  'queries.read_attendance',
])

const teacherAssignmentActions = new Set<AuthorizationAction>([
  'academics.record_progress',
  'academics.read_progress',
  'attendance.record',
  'attendance.read',
  'behavior.report_incident',
  'behavior.read_incidents',
  'resources.read',
  'attachments.read',
  'assessments.record_result',
  'assessments.read_results',
  'students.manage_notes',
  'queries.read_student_detail',
  'queries.read_class_curriculum',
  'queries.read_curriculum_progress',
  'queries.read_timetable',
  'queries.read_attendance',
])

const accountantActions = new Set<AuthorizationAction>([
  'finance.manage',
  'finance.read',
  'queries.read_student_detail',
])

/**
 * Initial application policy for the eight-module facade. Resource ownership
 * is resolved by each service before this policy is invoked.
 */
export class RepositoryAuthorizationPolicy implements AuthorizationPolicy {
  private readonly staffAssignments: SchoolRepositories['staffAssignments']
  private readonly staffMembers: SchoolRepositories['staffMembers']
  private readonly guardians: SchoolRepositories['guardians']
  private readonly guardianStudentLinks: SchoolRepositories['guardianLinks']
  private readonly students: SchoolRepositories['students']

  constructor(args: RepositoryAuthorizationPolicyArgs) {
    this.staffAssignments = args.staffAssignmentRepository
    this.staffMembers = args.staffMemberRepository
    this.guardians = args.guardianRepository
    this.guardianStudentLinks = args.guardianStudentLinkRepository
    this.students = args.studentRepository
  }

  async requirePermission(actor: ActorMetadata, request: AuthorizationRequest): Promise<void> {
    if (actor.schoolId !== request.resource.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    switch (actor.kind) {
      case 'staff':
        if (request.action === 'setup.register_school' && actor.roles.some(role => elevatedRoles.has(role))) {
          return
        }
        await this.requireStaffPermission(actor.staffMemberId, request)
        return
      case 'guardian':
        await this.requireGuardianPermission(actor.guardianId, request)
        return
      case 'student':
        await this.requireStudentPermission(actor.studentId, request)
        return
      case 'system':
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }

  private async requireStaffPermission(
    staffMemberId: string,
    request: AuthorizationRequest,
  ): Promise<void> {
    const staffMember = await this.staffMembers.findById(staffMemberId)
    if (!staffMember || !staffMember.isActive || staffMember.schoolId !== request.resource.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    const roles = staffMember.roles
    if (roles.some(role => elevatedRoles.has(role))) {
      return
    }
    if (roles.includes(StaffRole.Coordinator) && coordinatorActions.has(request.action)) {
      return
    }
    if (roles.includes(StaffRole.Accountant) && accountantActions.has(request.action)) {
      return
    }
    if (
      roles.includes(StaffRole.Teacher)
      && teacherAssignmentActions.has(request.action)
      && await this.isAssigned(staffMemberId, request.resource)
    ) {
      return
    }
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  private async requireGuardianPermission(guardianId: string, request: AuthorizationRequest): Promise<void> {
    const guardian = await this.guardians.findById(guardianId)
    if (!guardian || !guardian.hasAccess || guardian.schoolId !== request.resource.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    if (request.action === 'queries.read_guardian_self' && request.resource.guardianId === guardianId) {
      return
    }
    if (
      request.action === 'queries.read_student_detail'
      && request.resource.studentId
      && (await this.guardianStudentLinks.findByGuardianAndStudent(guardianId, request.resource.studentId))?.schoolId
      === request.resource.schoolId
    ) {
      return
    }
    if (
      (request.action === 'attendance.read' || request.action === 'finance.read')
      && request.resource.studentId
      && (await this.guardianStudentLinks.findByGuardianAndStudent(guardianId, request.resource.studentId))?.schoolId
      === request.resource.schoolId
    ) {
      return
    }
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  private async requireStudentPermission(studentId: string, request: AuthorizationRequest): Promise<void> {
    const student = await this.students.findById(studentId)
    if (!student || student.status !== StudentStatus.Active || student.schoolId !== request.resource.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    if (
      request.action === 'queries.read_student_detail'
      && request.resource.studentId === studentId
    ) {
      return
    }
    if (
      (request.action === 'attendance.read' || request.action === 'finance.read')
      && request.resource.studentId === studentId
    ) {
      return
    }
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  private async isAssigned(
    staffMemberId: string,
    resource: AuthorizationResourceContext,
  ): Promise<boolean> {
    if (resource.sessionId) {
      const assignments = await this.staffAssignments.list({ sessionId: resource.sessionId })
      if (assignments.some(assignment => assignment.staffId === staffMemberId)) {
        return true
      }
    }
    if (resource.classSubjectId) {
      const assignments = await this.staffAssignments.list({ classSubjectId: resource.classSubjectId })
      if (assignments.some(assignment => assignment.staffId === staffMemberId)) {
        return true
      }
    }
    if (resource.classGroupId) {
      const assignments = await this.staffAssignments.list({ classGroupId: resource.classGroupId })
      return assignments.some(assignment => assignment.staffId === staffMemberId)
    }
    return false
  }
}
