import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from './actor-metadata'

import { checkAssessmentAccess, checkClassGroupAccess, checkReportCardResultAccess } from './access-resolvers/academic-resolver'
import { checkFeeAccess, checkStudentFeeAccess } from './access-resolvers/finance-resolver'
import { checkGlobalAction, checkModuleAccess } from './access-resolvers/global-resolver'
import { checkAttendanceAccess, checkSessionAccess } from './access-resolvers/scheduling-resolver'
import { checkGuardianAccess, checkStudentAccess, checkStudentHealthAccess, checkStudentNoteAccess } from './access-resolvers/student-resolver'

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

/**
 * Evaluates actor access after a service has resolved the resource context
 * required by its use case. Implementations may consult current repository
 * relationships such as staff assignments or guardian/student links.
 */
export interface AuthorizationPolicy {
  checkStudentAccess: (actor: ActorMetadata, studentIds: readonly string[]) => Promise<void>
  checkGuardianAccess: (actor: ActorMetadata, guardianIds: readonly string[]) => Promise<void>
  checkStudentNoteAccess: (actor: ActorMetadata, noteIds: readonly string[]) => Promise<void>
  checkStudentHealthAccess: (actor: ActorMetadata, profileIds: readonly string[]) => Promise<void>
  checkClassGroupAccess: (actor: ActorMetadata, classGroupIds: readonly string[]) => Promise<void>
  checkAssessmentAccess: (actor: ActorMetadata, assessmentIds: readonly string[]) => Promise<void>
  checkReportCardResultAccess: (actor: ActorMetadata, reportCardResultIds: readonly string[]) => Promise<void>
  checkFeeAccess: (actor: ActorMetadata, feeIds: readonly string[]) => Promise<void>
  checkStudentFeeAccess: (actor: ActorMetadata, studentFeeIds: readonly string[]) => Promise<void>
  checkSessionAccess: (actor: ActorMetadata, sessionIds: readonly string[]) => Promise<void>
  checkAttendanceAccess: (actor: ActorMetadata, studentIds: readonly string[], sessionIds: readonly string[]) => Promise<void>
  checkGlobalAction: (actor: ActorMetadata, action: string) => Promise<void>
  checkModuleAccess: (actor: ActorMetadata, schoolId: string, module: string) => Promise<void>
}

export interface AuthorizedServiceArgs {
  actor: ActorMetadata
  authorizationPolicy: AuthorizationPolicy
}

export interface RepositoryAuthorizationPolicyArgs {
  repositories?: SchoolRepositories
  staffAssignmentRepository?: SchoolRepositories['staffAssignments']
  staffMemberRepository?: SchoolRepositories['staffMembers']
  guardianRepository?: SchoolRepositories['guardians']
  guardianStudentLinkRepository?: SchoolRepositories['guardianLinks']
  studentRepository?: SchoolRepositories['students']
}

export class RepositoryAuthorizationPolicy implements AuthorizationPolicy {
  private readonly repositories: SchoolRepositories

  constructor(args: RepositoryAuthorizationPolicyArgs) {
    this.repositories = args.repositories ?? {
      staffAssignments: args.staffAssignmentRepository,
      staffMembers: args.staffMemberRepository,
      guardians: args.guardianRepository,
      guardianLinks: args.guardianStudentLinkRepository,
      students: args.studentRepository,
    } as unknown as SchoolRepositories
  }

  async checkStudentAccess(actor: ActorMetadata, studentIds: readonly string[]): Promise<void> {
    await checkStudentAccess(actor, studentIds, this.repositories)
  }

  async checkGuardianAccess(actor: ActorMetadata, guardianIds: readonly string[]): Promise<void> {
    await checkGuardianAccess(actor, guardianIds, this.repositories)
  }

  async checkStudentNoteAccess(actor: ActorMetadata, noteIds: readonly string[]): Promise<void> {
    await checkStudentNoteAccess(actor, noteIds, this.repositories)
  }

  async checkStudentHealthAccess(actor: ActorMetadata, profileIds: readonly string[]): Promise<void> {
    await checkStudentHealthAccess(actor, profileIds, this.repositories)
  }

  async checkClassGroupAccess(actor: ActorMetadata, classGroupIds: readonly string[]): Promise<void> {
    await checkClassGroupAccess(actor, classGroupIds, this.repositories)
  }

  async checkAssessmentAccess(actor: ActorMetadata, assessmentIds: readonly string[]): Promise<void> {
    await checkAssessmentAccess(actor, assessmentIds, this.repositories)
  }

  async checkReportCardResultAccess(actor: ActorMetadata, reportCardResultIds: readonly string[]): Promise<void> {
    await checkReportCardResultAccess(actor, reportCardResultIds, this.repositories)
  }

  async checkFeeAccess(actor: ActorMetadata, feeIds: readonly string[]): Promise<void> {
    await checkFeeAccess(actor, feeIds, this.repositories)
  }

  async checkStudentFeeAccess(actor: ActorMetadata, studentFeeIds: readonly string[]): Promise<void> {
    await checkStudentFeeAccess(actor, studentFeeIds, this.repositories)
  }

  async checkSessionAccess(actor: ActorMetadata, sessionIds: readonly string[]): Promise<void> {
    await checkSessionAccess(actor, sessionIds, this.repositories)
  }

  async checkAttendanceAccess(actor: ActorMetadata, studentIds: readonly string[], sessionIds: readonly string[]): Promise<void> {
    await checkAttendanceAccess(actor, studentIds, sessionIds, this.repositories)
  }

  async checkGlobalAction(actor: ActorMetadata, action: string): Promise<void> {
    await checkGlobalAction(actor, action, this.repositories)
  }

  async checkModuleAccess(actor: ActorMetadata, schoolId: string, module: string): Promise<void> {
    await checkModuleAccess(actor, schoolId, module, this.repositories)
  }
}
