import type { SchoolRepositories } from '../../../ports/repositories/school-repositories'
import type { AuthorizationPolicy, RepositoryAuthorizationPolicyArgs } from './types'
import {
  checkAssessmentAccess,
  checkAttendanceAccess,
  checkClassGroupAccess,
  checkFeeAccess,
  checkGuardianAccess,
  checkReportCardResultAccess,
  checkSessionAccess,
  checkStudentAccess,
  checkStudentFeeAccess,
  checkStudentHealthAccess,
  checkStudentNoteAccess,
} from './resolvers'

function resolveRepositories(args: RepositoryAuthorizationPolicyArgs): SchoolRepositories {
  return args.repositories ?? {
    staffAssignments: args.staffAssignmentRepository,
    staffMembers: args.staffMemberRepository,
    guardians: args.guardianRepository,
    guardianLinks: args.guardianStudentLinkRepository,
    students: args.studentRepository,
  } as unknown as SchoolRepositories
}

export function createRepositoryAuthorizationPolicy(
  args: RepositoryAuthorizationPolicyArgs,
): AuthorizationPolicy {
  const repositories = resolveRepositories(args)

  return {
    checkStudentAccess: (actor, studentIds) => checkStudentAccess(actor, studentIds, repositories),
    checkGuardianAccess: (actor, guardianIds) => checkGuardianAccess(actor, guardianIds, repositories),
    checkStudentNoteAccess: (actor, noteIds) => checkStudentNoteAccess(actor, noteIds, repositories),
    checkStudentHealthAccess: (actor, profileIds) => checkStudentHealthAccess(actor, profileIds, repositories),
    checkClassGroupAccess: (actor, classGroupIds) => checkClassGroupAccess(actor, classGroupIds, repositories),
    checkAssessmentAccess: (actor, assessmentIds) => checkAssessmentAccess(actor, assessmentIds, repositories),
    checkReportCardResultAccess: (actor, reportCardResultIds) => checkReportCardResultAccess(actor, reportCardResultIds, repositories),
    checkFeeAccess: (actor, feeIds) => checkFeeAccess(actor, feeIds, repositories),
    checkStudentFeeAccess: (actor, studentFeeIds) => checkStudentFeeAccess(actor, studentFeeIds, repositories),
    checkSessionAccess: (actor, sessionIds) => checkSessionAccess(actor, sessionIds, repositories),
    checkAttendanceAccess: (actor, studentIds, sessionIds) => checkAttendanceAccess(actor, studentIds, sessionIds, repositories),
    getRepositories: () => repositories,
  }
}
