import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt } from '$lib/core/utils/validation'

export enum AttachmentOwnerKind {
  HealthRecord = 'health_record',
  Incident = 'incident',
  Student = 'student',
  ReportCard = 'report_card',
  Other = 'other',
}

export interface AttachmentArgs {
  id: string
  schoolId: string
  ownerKind: AttachmentOwnerKind
  ownerId: string
  fileName: string
  fileUrl: string
  mimeType?: string | null
  sizeBytes?: number | null
  uploadedById?: string | null
  createdAt?: Date
}

/**
 * Represents a file attached to a domain entity (health record, incident, student profile, etc.).
 * Uses a polymorphic owner pattern (ownerKind + ownerId) to associate files
 * with any supported parent entity without requiring foreign keys on each entity.
 */
export class Attachment {
  readonly id: string
  readonly schoolId: string
  readonly ownerKind: AttachmentOwnerKind
  readonly ownerId: string
  readonly fileName: string
  readonly fileUrl: string
  readonly mimeType?: string
  readonly sizeBytes?: number
  readonly uploadedById?: string
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    ownerKind,
    ownerId,
    fileName,
    fileUrl,
    mimeType,
    sizeBytes,
    uploadedById,
    createdAt,
  }: AttachmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.ownerKind = ownerKind
    this.ownerId = requireNonBlank(ownerId, 'ownerId')
    this.fileName = requireNonBlank(fileName, 'fileName')
    this.fileUrl = requireNonBlank(fileUrl, 'fileUrl')
    this.mimeType = requireOptionalNonBlank(mimeType, 'mimeType')
    if (sizeBytes != null) {
      this.sizeBytes = requirePositiveInt(sizeBytes, 'sizeBytes')
    }
    this.uploadedById = requireOptionalNonBlank(uploadedById, 'uploadedById')
    this.createdAt = createdAt ?? new Date()
  }
}
