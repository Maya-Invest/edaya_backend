import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../model/actor'
import type { AuthorizationPolicy, RepositoryAuthorizationPolicyArgs } from './types'
import {
  checkAssessmentAccess,
  checkAttendanceAccess,
  checkClassGroupAccess,
  checkFeeAccess,
  checkGuardianAccess,
  checkModuleAccess,
  checkReportCardResultAccess,
  checkSessionAccess,
  checkStudentAccess,
  checkStudentFeeAccess,
  checkStudentHealthAccess,
  checkStudentNoteAccess,
} from './resolvers'

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

  async checkModuleAccess(actor: ActorMetadata, schoolId: string, module: string): Promise<void> {
    await checkModuleAccess(actor, schoolId, module, this.repositories)
  }

  getRepositories(): SchoolRepositories {
    return this.repositories
  }
}
