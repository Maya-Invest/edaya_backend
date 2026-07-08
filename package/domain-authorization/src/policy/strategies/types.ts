import type { AuthorizationRepositories } from '@edaya/authorization'
import type { ReportCardResult } from '@edaya/core'
import type {
  GuardianActorMetadata,
  StaffActorMetadata,
  StudentActorMetadata,
  TeacherActorMetadata,
} from '../../model/actor'

export type StudentAccessStrategy<A> = (
  actor: A,
  studentIds: readonly string[],
  repos: AuthorizationRepositories,
) => Promise<void>

export type ClassGroupAccessStrategy<A> = (
  actor: A,
  classGroupIds: readonly string[],
  repos: AuthorizationRepositories,
) => Promise<void>

export type ReportCardResultAccessStrategy<A> = (
  actor: A,
  results: readonly ReportCardResult[],
  repos: AuthorizationRepositories,
) => Promise<void>

export type StaffStudentAccess = StudentAccessStrategy<StaffActorMetadata>
export type TeacherStudentAccess = StudentAccessStrategy<TeacherActorMetadata>
export type GuardianStudentAccess = StudentAccessStrategy<GuardianActorMetadata>
export type StudentSelfStudentAccess = StudentAccessStrategy<StudentActorMetadata>

export type StaffClassGroupAccess = ClassGroupAccessStrategy<StaffActorMetadata>
export type TeacherClassGroupAccess = ClassGroupAccessStrategy<TeacherActorMetadata>
export type GuardianClassGroupAccess = ClassGroupAccessStrategy<GuardianActorMetadata>
export type StudentSelfClassGroupAccess = ClassGroupAccessStrategy<StudentActorMetadata>

export type StaffReportCardResultAccess = ReportCardResultAccessStrategy<StaffActorMetadata>
export type TeacherReportCardResultAccess = ReportCardResultAccessStrategy<TeacherActorMetadata>
export type GuardianReportCardResultAccess = ReportCardResultAccessStrategy<GuardianActorMetadata>
export type StudentSelfReportCardResultAccess = ReportCardResultAccessStrategy<StudentActorMetadata>
