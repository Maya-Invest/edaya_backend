import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { directPermissionEntityConfig } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { resolveAttendanceRecordSchoolId } from '../scheduling/attendance-record-school'
import { parseDomain, zodDate } from '../shared/utils'

export enum AttachmentStatus {
  PendingUpload = 'pending_upload',
  Ready = 'ready',
  Failed = 'failed',
}

export enum AttachmentOwnerKind {
  StudentHealthProfile = 'student_health_profile',
  Incident = 'incident',
  Student = 'student',
  Guardian = 'guardian',
  ReportCard = 'report_card',
  Payment = 'payment',
  AttendanceRecord = 'attendance_record',
  AssessmentResult = 'assessment_result',
  StudentClassEnrollment = 'student_enrollment',
  StudentDisciplinaryAction = 'applied_disciplinary_action',
  Staff = 'staff',
  Other = 'other',
}

export const attachmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  ownerKind: z.nativeEnum(AttachmentOwnerKind),
  ownerId: z.string().trim().min(1, 'ownerId must not be blank'),
  fileName: z.string().trim().min(1, 'fileName must not be blank'),
  storageKey: z.string().trim().min(1, 'storageKey must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  fileUrl: z.string().trim().min(1, 'fileUrl must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(AttachmentStatus).default(AttachmentStatus.Ready),
  checksum: z.string().trim().min(1, 'checksum must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  mimeType: z.string().trim().min(1, 'mimeType must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  sizeBytes: z.number().int().positive('sizeBytes must be a strictly positive integer').nullable().optional().transform(v => v === null ? undefined : v),
  uploadedById: z.string().trim().min(1, 'uploadedById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export const attachmentSchema = attachmentBaseSchema.superRefine((value, ctx) => {
  if (!value.storageKey?.trim() && !value.fileUrl?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'storageKey or fileUrl is required',
      path: ['storageKey'],
    })
  }
})

export type AttachmentData = z.infer<typeof attachmentSchema>
export type AttachmentInput = z.input<typeof attachmentSchema>

export const attachmentCreateSchema = attachmentBaseSchema.omit({ createdAt: true })
export const attachmentUpdateSchema = attachmentBaseSchema.partial().required({ id: true })

/**
 * Represents a file attached to a domain entity (health record, incident, student profile, etc.).
 * Uses a polymorphic owner pattern (ownerKind + ownerId) to associate files
 * with any supported parent entity without requiring foreign keys on each entity.
 */
export class Attachment {
  readonly data: AttachmentData

  constructor(args: AttachmentInput) {
    this.data = parseDomain(attachmentSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get ownerKind() { return this.data.ownerKind }
  get ownerId() { return this.data.ownerId }
  get fileName() { return this.data.fileName }
  get storageKey() { return this.data.storageKey }
  get fileUrl() { return this.data.fileUrl }
  get status() { return this.data.status }
  get checksum() { return this.data.checksum }
  get mimeType() { return this.data.mimeType }
  get sizeBytes() { return this.data.sizeBytes }
  get uploadedById() { return this.data.uploadedById }
  get createdAt() { return this.data.createdAt }
}

export const attachmentConfig: EntityConfigFactory<Attachment> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.attachments,
    Permission.ATTACHMENT_READ,
    Permission.ATTACHMENT_CONFIGURE,
  )
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
