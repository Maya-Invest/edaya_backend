import type { AuthorizationRepositories } from '@edaya/authorization'
import type { AttachmentOwnerKind, AttendanceRecord, ReportCardResult } from '@edaya/core'
import type { ActorMetadata } from '../model/actor'

export interface AttachmentAccessInput {
  readonly ownerKind: AttachmentOwnerKind
  readonly ownerId: string
}

/**
 * Evaluates actor access after a service has resolved the resource context
 * required by its use case. Implementations may consult current repository
 * relationships such as staff assignments or guardian/student links.
 */
export interface AuthorizationPolicy {
  checkStudentAccess: (actor: ActorMetadata, studentIds: readonly string[]) => Promise<void>
  checkGuardianAccess: (actor: ActorMetadata, guardianIds: readonly string[]) => Promise<void>
  checkTeacherAccess: (actor: ActorMetadata, teacherIds: readonly string[]) => Promise<void>
  checkStudentNoteAccess: (actor: ActorMetadata, noteIds: readonly string[]) => Promise<void>
  checkStudentHealthAccess: (actor: ActorMetadata, profileIds: readonly string[]) => Promise<void>
  checkStaffAssignmentAccess: (actor: ActorMetadata, assignments: readonly { staffId: string }[]) => Promise<void>
  checkStaffMemberReadAccess: (actor: ActorMetadata, staffMembers: readonly { id: string }[]) => Promise<void>
  checkTeacherAssignmentAccess: (actor: ActorMetadata, assignments: readonly { teacherId: string }[]) => Promise<void>
  checkClassGroupAccess: (actor: ActorMetadata, classGroupIds: readonly string[]) => Promise<void>
  checkAssessmentAccess: (actor: ActorMetadata, assessmentIds: readonly string[]) => Promise<void>
  checkReportCardResultAccess: (actor: ActorMetadata, reportCardResultIds: readonly string[]) => Promise<void>
  authorizeReportCardResultSave: (
    actor: ActorMetadata,
    entity: ReportCardResult,
    existing: ReportCardResult | undefined,
  ) => Promise<void>
  checkFeeAccess: (actor: ActorMetadata, feeIds: readonly string[]) => Promise<void>
  checkStudentFeeAccess: (actor: ActorMetadata, studentFeeIds: readonly string[]) => Promise<void>
  checkLessonSessionAccess: (actor: ActorMetadata, lessonSessionIds: readonly string[]) => Promise<void>
  checkLessonSessionReadAccess: (actor: ActorMetadata, lessonSessionIds: readonly string[]) => Promise<void>
  checkActivitySessionAccess: (actor: ActorMetadata, activitySessionIds: readonly string[]) => Promise<void>
  checkAttendanceRecordAccess: (actor: ActorMetadata, records: readonly AttendanceRecord[]) => Promise<void>
  checkAttachmentAccess: (actor: ActorMetadata, attachments: readonly AttachmentAccessInput[]) => Promise<void>
  getRepositories?: () => AuthorizationRepositories
}

export interface AuthorizedServiceArgs {
  actor: ActorMetadata
  authorizationPolicy: AuthorizationPolicy
}

export interface RepositoryAuthorizationPolicyArgs {
  repositories?: AuthorizationRepositories
  staffAssignmentRepository?: AuthorizationRepositories['staffAssignments']
  staffMemberRepository?: AuthorizationRepositories['staffMembers']
  guardianRepository?: AuthorizationRepositories['guardians']
  guardianStudentLinkRepository?: AuthorizationRepositories['guardianLinks']
  studentRepository?: AuthorizationRepositories['students']
}
