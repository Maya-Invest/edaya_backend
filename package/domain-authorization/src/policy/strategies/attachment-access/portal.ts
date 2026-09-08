import type { AttendanceRecord } from '@edaya/core'
import type { ActorMetadata } from '../../../model/actor'
import type { AuthorizationRepositories } from '../../../ports/authorization-repositories'
import type { AttachmentAccessInput } from '../../types'
import { AttachmentOwnerKind } from '@edaya/core'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'
import { checkClassGroupAccess, checkReportCardResultAccess } from '../../resolvers/academic'
import { checkStudentFeeAccess } from '../../resolvers/finance'
import { checkAttendanceRecordAccess } from '../../resolvers/scheduling'
import { checkGuardianAccess, checkStudentAccess, checkStudentHealthAccess } from '../../resolvers/student'

export async function portalAttachmentAccess(
  actor: ActorMetadata,
  attachments: readonly AttachmentAccessInput[],
  repos: AuthorizationRepositories,
): Promise<void> {
  for (const attachment of attachments) {
    await checkPortalAttachmentOwner(actor, attachment.ownerKind, attachment.ownerId, repos)
  }
}

async function checkPortalAttachmentOwner(
  actor: ActorMetadata,
  ownerKind: AttachmentOwnerKind,
  ownerId: string,
  repos: AuthorizationRepositories,
): Promise<void> {
  switch (ownerKind) {
    case AttachmentOwnerKind.Student:
      await checkStudentAccess(actor, [ownerId], repos)
      return
    case AttachmentOwnerKind.Guardian:
      await checkGuardianAccess(actor, [ownerId], repos)
      return
    case AttachmentOwnerKind.ReportCard:
      await checkReportCardResultAccess(actor, [ownerId], repos)
      return
    case AttachmentOwnerKind.Payment:
      await checkPaymentAttachmentAccess(actor, ownerId, repos)
      return
    case AttachmentOwnerKind.AssessmentResult:
      await checkAssessmentResultAttachmentAccess(actor, ownerId, repos)
      return
    case AttachmentOwnerKind.AttendanceRecord:
      await checkAttendanceAttachmentAccess(actor, ownerId, repos)
      return
    case AttachmentOwnerKind.StudentClassEnrollment:
      await checkEnrollmentAttachmentAccess(actor, ownerId, repos)
      return
    case AttachmentOwnerKind.StudentDisciplinaryAction:
      await checkDisciplinaryActionAttachmentAccess(actor, ownerId, repos)
      return
    case AttachmentOwnerKind.Incident:
      await checkIncidentAttachmentAccess(actor, ownerId, repos)
      return
    case AttachmentOwnerKind.StudentHealthProfile:
      await checkStudentHealthAccess(actor, [ownerId], repos)
      return
    case AttachmentOwnerKind.Staff:
    case AttachmentOwnerKind.Other:
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

async function checkPaymentAttachmentAccess(
  actor: ActorMetadata,
  paymentId: string,
  repos: AuthorizationRepositories,
): Promise<void> {
  const payment = await repos.payments.findById(paymentId)
  if (!payment) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  await checkStudentFeeAccess(actor, [payment.studentFeeId], repos)
}

async function checkAssessmentResultAttachmentAccess(
  actor: ActorMetadata,
  assessmentResultId: string,
  repos: AuthorizationRepositories,
): Promise<void> {
  const result = await repos.assessmentResults.findById(assessmentResultId)
  if (!result) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  await checkStudentAccess(actor, [result.studentId], repos)
}

async function checkAttendanceAttachmentAccess(
  actor: ActorMetadata,
  attendanceRecordId: string,
  repos: AuthorizationRepositories,
): Promise<void> {
  const record = await repos.attendance.findById(attendanceRecordId)
  if (!record) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  await checkAttendanceRecordAccess(actor, [record as AttendanceRecord], repos)
}

async function checkEnrollmentAttachmentAccess(
  actor: ActorMetadata,
  enrollmentId: string,
  repos: AuthorizationRepositories,
): Promise<void> {
  const enrollment = await repos.enrollments.findById(enrollmentId)
  if (!enrollment) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  await checkStudentAccess(actor, [enrollment.studentId], repos)
}

async function checkDisciplinaryActionAttachmentAccess(
  actor: ActorMetadata,
  actionId: string,
  repos: AuthorizationRepositories,
): Promise<void> {
  const action = await repos.studentDisciplinaryActions.findById(actionId)
  if (!action) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  await checkStudentAccess(actor, [action.studentId], repos)
}

async function checkIncidentAttachmentAccess(
  actor: ActorMetadata,
  incidentId: string,
  repos: AuthorizationRepositories,
): Promise<void> {
  const incident = await repos.incidents.findById(incidentId)
  if (!incident?.classGroupId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  await checkClassGroupAccess(actor, [incident.classGroupId], repos)
}
