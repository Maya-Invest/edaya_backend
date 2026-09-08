import type { AuthorizationRepositories } from '../ports/authorization-repositories'
import type { AuthorizationPolicy, RepositoryAuthorizationPolicyArgs } from './types'
import {
  authorizeReportCardResultSave,
  checkActivitySessionAccess,
  checkAssessmentAccess,
  checkAttachmentAccess,
  checkAttendanceRecordAccess,
  checkClassGroupAccess,
  checkFeeAccess,
  checkGuardianAccess,
  checkLessonSessionAccess,
  checkLessonSessionReadAccess,
  checkReportCardResultAccess,
  checkStaffAssignmentAccess,
  checkStaffMemberReadAccess,
  checkStudentAccess,
  checkStudentFeeAccess,
  checkStudentHealthAccess,
  checkStudentNoteAccess,
  checkTeacherAccess,
  checkTeacherAssignmentAccess,
} from './resolvers'

function resolveRepositories(args: RepositoryAuthorizationPolicyArgs): AuthorizationRepositories {
  return args.repositories ?? {
    staffAssignments: args.staffAssignmentRepository,
    staffMembers: args.staffMemberRepository,
    guardians: args.guardianRepository,
    guardianLinks: args.guardianStudentLinkRepository,
    students: args.studentRepository,
  } as unknown as AuthorizationRepositories
}

export function createRepositoryAuthorizationPolicy(
  args: RepositoryAuthorizationPolicyArgs,
): AuthorizationPolicy {
  const repositories = resolveRepositories(args)

  return {
    checkStudentAccess: (actor, studentIds) => checkStudentAccess(actor, studentIds, repositories),
    checkGuardianAccess: (actor, guardianIds) => checkGuardianAccess(actor, guardianIds, repositories),
    checkTeacherAccess: (actor, teacherIds) => checkTeacherAccess(actor, teacherIds, repositories),
    checkStudentNoteAccess: (actor, noteIds) => checkStudentNoteAccess(actor, noteIds, repositories),
    checkStudentHealthAccess: (actor, profileIds) => checkStudentHealthAccess(actor, profileIds, repositories),
    checkStaffAssignmentAccess: (actor, assignments) => checkStaffAssignmentAccess(actor, assignments),
    checkStaffMemberReadAccess: (actor, staffMembers) => checkStaffMemberReadAccess(actor, staffMembers),
    checkTeacherAssignmentAccess: (actor, assignments) => checkTeacherAssignmentAccess(actor, assignments),
    checkClassGroupAccess: (actor, classGroupIds) => checkClassGroupAccess(actor, classGroupIds, repositories),
    checkAssessmentAccess: (actor, assessmentIds) => checkAssessmentAccess(actor, assessmentIds, repositories),
    checkReportCardResultAccess: (actor, reportCardResultIds) => checkReportCardResultAccess(actor, reportCardResultIds, repositories),
    authorizeReportCardResultSave: (actor, entity, existing) => authorizeReportCardResultSave(actor, entity, existing, repositories),
    checkFeeAccess: (actor, feeIds) => checkFeeAccess(actor, feeIds, repositories),
    checkStudentFeeAccess: (actor, studentFeeIds) => checkStudentFeeAccess(actor, studentFeeIds, repositories),
    checkLessonSessionAccess: (actor, lessonSessionIds) => checkLessonSessionAccess(actor, lessonSessionIds, repositories),
    checkLessonSessionReadAccess: (actor, lessonSessionIds) => checkLessonSessionReadAccess(actor, lessonSessionIds, repositories),
    checkActivitySessionAccess: (actor, activitySessionIds) => checkActivitySessionAccess(actor, activitySessionIds, repositories),
    checkAttendanceRecordAccess: (actor, records) => checkAttendanceRecordAccess(actor, records, repositories),
    checkAttachmentAccess: (actor, attachments) => checkAttachmentAccess(actor, attachments, repositories),
    getRepositories: () => repositories,
  }
}
