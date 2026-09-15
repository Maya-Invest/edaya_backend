import type { Attachment } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { AttachmentOwnerKind, BusinessRuleViolationError, resolveAttendanceRecordSchoolId } from '@edaya/core'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/school/attachment.ts (PR3)
export const attachmentConfig: EntityConfigFactory<Attachment> = ({ repositories, atomicExecution }) => {
  return config({
    repository: repositories.attachments,
    tenant: directSchoolTenant(),
    resource: 'attachments',

    gates: {
      preSave: async () => {
        throw new BusinessRuleViolationError('ATTACHMENT_COMMAND_REQUIRED', 'Attachments require an admitted upload completion or document command')
      },
    },
    atomicExecution,
  })
}

export async function validateAttachmentSave(
  attachment: Attachment,
  existing: Attachment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (existing && (existing.purpose !== attachment.purpose || existing.ownerKind !== attachment.ownerKind || existing.ownerId !== attachment.ownerId))
    throw new BusinessRuleViolationError('ATTACHMENT_OWNER_PURPOSE_IMMUTABLE', 'Attachment owner and purpose cannot be changed')
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
    case AttachmentOwnerKind.Staff:
      return requireOwned(repositories.staffMembers.findById(ownerId))
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
      const schoolId = await resolveAttendanceRecordSchoolId(repositories, record)
      if (!schoolId) {
        denyResourceAccess()
      }
      const student = await repositories.students.findById(record.studentId)
      if (!student || student.schoolId !== schoolId) {
        denyResourceAccess()
      }
      return { schoolId }
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
      const account = await repositories.studentYearAccounts.findById(payment.accountId)
      if (!account) {
        denyResourceAccess()
      }
      return resolveStudentOwner(account.studentId, repositories)
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
