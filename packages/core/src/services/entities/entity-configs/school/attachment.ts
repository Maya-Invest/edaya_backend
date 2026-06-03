import type { Attachment } from '../../../../entities/school/attachment'
import type { SchoolRepositories } from '../../../../ports'
import type { EntityConfigFactory } from '../../../shared/common'
import { AttachmentOwnerKind } from '../../../../entities/school/attachment'
import { denyResourceAccess } from '../../../authorization'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { directEntityConfig } from '../../../shared/common'

export const attachmentConfig: EntityConfigFactory<Attachment> = (input) => {
  const config = directEntityConfig(input, input.repositories.attachments, 'attachments.read', 'attachments.manage')
  return {
    ...config,
    gates: {
      preSave: validateAttachmentSave,
    },
  }
}

export async function validateAttachmentSave(
  attachment: Attachment,
  _existing: Attachment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const context = await resolveAttachmentOwnerContext(attachment.ownerKind, attachment.ownerId, repositories)
  if (context.schoolId !== attachment.schoolId) {
    denyResourceAccess()
  }
}

async function resolveAttachmentOwnerContext(
  ownerKind: AttachmentOwnerKind,
  ownerId: string,
  repositories: SchoolRepositories,
): Promise<{ schoolId: string }> {
  switch (ownerKind) {
    case AttachmentOwnerKind.Student:
      return resolveStudentOwner(ownerId, repositories)
    case AttachmentOwnerKind.Guardian:
      return requireOwned(repositories.guardians.findById(ownerId))
    case AttachmentOwnerKind.StudentHealthProfile: {
      const healthProfile = await repositories.studentHealthProfiles.findById(ownerId)
      if (!healthProfile) {
        denyResourceAccess()
      }
      return { schoolId: healthProfile.schoolId }
    }
    case AttachmentOwnerKind.StudentClassEnrollment: {
      const enrollment = await repositories.enrollments.findById(ownerId)
      if (!enrollment) {
        denyResourceAccess()
      }
      const classGroup = await repositories.classGroups.findById(enrollment.classGroupId)
      const student = await repositories.students.findById(enrollment.studentId)
      if (!classGroup || !student || student.schoolId !== classGroup.schoolId) {
        denyResourceAccess()
      }
      return { schoolId: classGroup.schoolId }
    }
    case AttachmentOwnerKind.AttendanceRecord: {
      const record = await repositories.attendance.findById(ownerId)
      if (!record) {
        denyResourceAccess()
      }
      const session = await repositories.sessions.findById(record.sessionId)
      if (!session) {
        denyResourceAccess()
      }
      const classGroup = await repositories.classGroups.findById(session.classGroupId)
      const student = await repositories.students.findById(record.studentId)
      if (!classGroup || !student || student.schoolId !== classGroup.schoolId) {
        denyResourceAccess()
      }
      return { schoolId: classGroup.schoolId }
    }
    case AttachmentOwnerKind.Incident:
      return requireOwned(repositories.incidents.findById(ownerId))
    case AttachmentOwnerKind.StudentDisciplinaryAction: {
      const action = await repositories.studentDisciplinaryActions.findById(ownerId)
      if (!action) {
        denyResourceAccess()
      }
      return resolveStudentOwner(action.studentId, repositories)
    }
    case AttachmentOwnerKind.AssessmentResult: {
      const result = await repositories.assessmentResults.findById(ownerId)
      if (!result) {
        denyResourceAccess()
      }
      return resolveStudentOwner(result.studentId, repositories)
    }
    case AttachmentOwnerKind.ReportCard: {
      const result = await repositories.results.findById(ownerId)
      if (!result) {
        denyResourceAccess()
      }
      return resolveStudentOwner(result.studentId, repositories)
    }
    case AttachmentOwnerKind.Payment: {
      const payment = await repositories.payments.findById(ownerId)
      if (!payment) {
        denyResourceAccess()
      }
      const studentFee = await repositories.studentFees.findById(payment.studentFeeId)
      if (!studentFee) {
        denyResourceAccess()
      }
      return resolveStudentOwner(studentFee.studentId, repositories)
    }
    case AttachmentOwnerKind.Other:
      throw new BusinessRuleViolationError('UNSUPPORTED_ATTACHMENT_OWNER', 'Attachment owner kind other is not supported by the selected public contract')
  }
}

async function resolveStudentOwner(studentId: string, repositories: SchoolRepositories): Promise<{ schoolId: string }> {
  const student = await repositories.students.findById(studentId)
  if (!student) {
    denyResourceAccess()
  }
  return { schoolId: student.schoolId }
}

async function requireOwned<T extends { schoolId: string }>(resourcePromise: Promise<T | undefined>): Promise<{ schoolId: string }> {
  const resource = await resourcePromise
  if (!resource) {
    denyResourceAccess()
  }
  return { schoolId: resource.schoolId }
}
