import type { AttendanceRecord } from '../../../domain/scheduling/attendance-record'
import type { SchoolRepositories } from '../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../model/actor'

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
  checkLessonSessionAccess: (actor: ActorMetadata, lessonSessionIds: readonly string[]) => Promise<void>
  checkActivitySessionAccess: (actor: ActorMetadata, activitySessionIds: readonly string[]) => Promise<void>
  checkAttendanceRecordAccess: (actor: ActorMetadata, records: readonly AttendanceRecord[]) => Promise<void>
  getRepositories?: () => SchoolRepositories
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
