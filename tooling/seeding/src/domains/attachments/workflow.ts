import type { AttachmentsSeedPort } from './port'
import { AttachmentOwnerKind } from '@edaya/core'
import { SEED_ATTACHMENTS } from '@edaya/fixtures'
import { seedDateTime } from '../../support/seed-date'

const ATTACHMENT_OWNER_KIND_BY_SEED = {
  student_health_profile: AttachmentOwnerKind.StudentHealthProfile,
  incident: AttachmentOwnerKind.Incident,
  student: AttachmentOwnerKind.Student,
  guardian: AttachmentOwnerKind.Guardian,
  report_card: AttachmentOwnerKind.ReportCard,
  payment: AttachmentOwnerKind.Payment,
  attendance_record: AttachmentOwnerKind.AttendanceRecord,
  assessment_result: AttachmentOwnerKind.AssessmentResult,
  student_enrollment: AttachmentOwnerKind.StudentClassEnrollment,
  applied_disciplinary_action: AttachmentOwnerKind.StudentDisciplinaryAction,
} as const

export async function seedDevAttachments(
  port: AttachmentsSeedPort,
): Promise<{ attachments: number }> {
  for (const attachment of SEED_ATTACHMENTS) {
    await port.saveAttachment({
      id: attachment.id,
      schoolId: attachment.schoolId,
      ownerKind: ATTACHMENT_OWNER_KIND_BY_SEED[attachment.ownerKind],
      ownerId: attachment.ownerId,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      uploadedById: attachment.uploadedById,
      createdAt: seedDateTime(attachment.createdAt),
    })
  }

  return { attachments: SEED_ATTACHMENTS.length }
}
