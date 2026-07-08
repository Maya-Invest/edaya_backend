import type { AuthorizationRepositories } from '@edaya/authorization'
import type { ReportCardResult } from '@edaya/core'
import type { StaffActorMetadata, TeacherActorMetadata } from '../../../model/actor'
import type {
  GuardianReportCardResultAccess,
  StaffReportCardResultAccess,
  StudentSelfReportCardResultAccess,
  TeacherReportCardResultAccess,
} from '../types'
import { guardianStudentAccess } from '../student-access/guardian'
import { staffStudentAccess } from '../student-access/staff'
import { studentSelfStudentAccess } from '../student-access/student'
import {
  assertTeacherCanReadReportCard,
  authorizeTeacherReportCardCommentSave,
} from './comment-access'

export const staffReportCardResultAccess: StaffReportCardResultAccess = async (actor, results, repos) => {
  const studentIds = [...new Set(results.map(result => result.studentId))]
  await staffStudentAccess(actor, studentIds, repos)
}

export const teacherReportCardResultAccess: TeacherReportCardResultAccess = async (actor, results, repos) => {
  for (const result of results) {
    await assertTeacherCanReadReportCard(actor, result, repos)
  }
}

export const guardianReportCardResultAccess: GuardianReportCardResultAccess = async (actor, results, repos) => {
  const studentIds = [...new Set(results.map(result => result.studentId))]
  await guardianStudentAccess(actor, studentIds, repos)
}

export const studentSelfReportCardResultAccess: StudentSelfReportCardResultAccess = async (actor, results, repos) => {
  const studentIds = [...new Set(results.map(result => result.studentId))]
  await studentSelfStudentAccess(actor, studentIds, repos)
}

export async function authorizeReportCardCommentSave(
  actor: StaffActorMetadata | TeacherActorMetadata,
  before: ReportCardResult,
  after: ReportCardResult,
  repos: AuthorizationRepositories,
): Promise<void> {
  if (actor.kind === 'teacher') {
    authorizeTeacherReportCardCommentSave(actor, before, after)
    return
  }

  await staffReportCardResultAccess(actor, [before], repos)
}
