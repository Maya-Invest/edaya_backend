import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export enum AttachmentStatus {
  PendingUpload = 'pending_upload',
  Ready = 'ready',
  Failed = 'failed',
}

/** Generic attachment access never implies access to a feature-owned purpose. */
export const GENERAL_ATTACHMENT_PURPOSE = 'general'
export const attachmentPurposeSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/).max(100)

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
  Teacher = 'teacher',
  School = 'school',
  DocumentIssuance = 'document_issuance',
  Other = 'other',
}

export const attachmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  ownerKind: z.nativeEnum(AttachmentOwnerKind),
  ownerId: z.string().trim().min(1, 'ownerId must not be blank'),
  purpose: attachmentPurposeSchema.default(GENERAL_ATTACHMENT_PURPOSE),
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
  get purpose() { return this.data.purpose }
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
