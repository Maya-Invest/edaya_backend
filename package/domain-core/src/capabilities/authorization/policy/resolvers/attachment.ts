import type { AttendanceRecord } from '../../../../domain/scheduling/attendance-record'
import { AttachmentOwnerKind } from '../../../../domain/school/attachment'
import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import type { AttachmentAccessInput } from '../types'
import { actorHasAnyPermission } from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { Permission } from '../../permissions/permission'
import { checkClassGroupAccess, checkReportCardResultAccess } from './academic'
import { checkStudentFeeAccess } from './finance'
import { checkAttendanceRecordAccess } from './scheduling'
import { checkGuardianAccess, checkStudentAccess, checkStudentHealthAccess } from './student'

export type { AttachmentAccessInput } from '../types'

function isPortalActor(actor: ActorMetadata): boolean {
  return actor.kind === 'guardian' || actor.kind === 'student' || actor.kind === 'teacher'
}

export async function checkAttachmentAccess(
  actor: ActorMetadata,
  attachments: readonly AttachmentAccessInput[],
  repos: SchoolRepositories,
): Promise<void> {
  if (attachments.length === 0) {
    return
  }

  if (actor.kind === 'staff'
    && actorHasAnyPermission(actor, [Permission.ATTACHMENT_READ, Permission.ATTACHMENT_CONFIGURE])) {
    return
  }

  if (!isPortalActor(actor)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  for (const attachment of attachments) {
    await checkPortalAttachmentOwner(actor, attachment.ownerKind, attachment.ownerId, repos)
  }
}

async function checkPortalAttachmentOwner(
  actor: ActorMetadata,
  ownerKind: AttachmentOwnerKind,
  ownerId: string,
  repos: SchoolRepositories,
): Promise<void> {
  switch (ownerKind) {
    case AttachmentOwnerKind.Student:
      await checkStudentAccess(actor, [ownerId], repos)
      return
    case AttachmentOwnerKind.Guardian:
      await checkGuardianAccess(actor, [ownerId], repos)
      return
    case AttachmentOwnerKind.ReportCard:
      await checkReportCardAttachmentAccess(actor, ownerId, repos)
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

async function checkReportCardAttachmentAccess(
  actor: ActorMetadata,
  reportCardId: string,
  repos: SchoolRepositories,
): Promise<void> {
  await checkReportCardResultAccess(actor, [reportCardId], repos)
}

async function checkPaymentAttachmentAccess(
  actor: ActorMetadata,
  paymentId: string,
  repos: SchoolRepositories,
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
  repos: SchoolRepositories,
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
  repos: SchoolRepositories,
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
  repos: SchoolRepositories,
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
  repos: SchoolRepositories,
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
  repos: SchoolRepositories,
): Promise<void> {
  const incident = await repos.incidents.findById(incidentId)
  if (!incident?.classGroupId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  await checkClassGroupAccess(actor, [incident.classGroupId], repos)
}
