import type { SchoolService } from '@edaya/core'
import { Attachment, AttachmentOwnerKind } from '@edaya/core'
import {
  countSeedAttachments,
  parseSeedDate,
  SEED_ATTACHMENTS,
} from '@edaya/dev-fixtures'

const attachmentOwnerKindBySeed = {
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

export async function seedAttachments(service: SchoolService): Promise<{ attachments: number }> {
  for (const attachment of SEED_ATTACHMENTS) {
    await service.baseService.attachments.save(new Attachment({
      id: attachment.id,
      schoolId: attachment.schoolId,
      ownerKind: attachmentOwnerKindBySeed[attachment.ownerKind],
      ownerId: attachment.ownerId,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      uploadedById: attachment.uploadedById,
      createdAt: parseSeedDate(attachment.createdAt),
    }), { moduleChecked: true })
  }

  return { attachments: countSeedAttachments() }
}
