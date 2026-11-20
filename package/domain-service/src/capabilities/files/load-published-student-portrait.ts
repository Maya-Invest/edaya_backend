import type { BaseSchoolService } from '../../services/base-school-service'
import { AttachmentOwnerKind, PROFILE_PHOTO_JPEG_MIME } from '@edaya/core'
import { loadAttachmentAsset } from './load-attachment-asset'
import { profilePhotoReadPolicy } from './profile-photo-access'

/** Internal Plan 04 hook: published student portrait bytes only. */
export async function loadPublishedStudentPortrait(base: BaseSchoolService, studentId: string) {
  const student = await base.entities.students.findById(studentId)
  if (!student?.photoAttachmentId)
    return null
  const attachment = await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(student.photoAttachmentId)
  if (!attachment)
    return null
  return loadAttachmentAsset(base, {
    attachmentId: attachment.id,
    ownerKind: AttachmentOwnerKind.Student,
    ownerId: student.id,
    maxBytes: base.profilePhotoMaxBytes,
    allowedMimeTypes: [PROFILE_PHOTO_JPEG_MIME],
    access: profilePhotoReadPolicy(base, attachment),
  })
}
