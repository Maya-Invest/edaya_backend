import { BusinessRuleViolationError } from '../shared/business-rule-error'
import { AttachmentOwnerKind } from './attachment'

export const DEFAULT_PROFILE_PHOTO_MAX_BYTES = 1_048_576
export const PROFILE_PHOTO_JPEG_MIME = 'image/jpeg'
export const STUDENT_PORTRAIT_PURPOSE = 'student.portrait'
export const GUARDIAN_PORTRAIT_PURPOSE = 'guardian.portrait'
export const STAFF_PORTRAIT_PURPOSE = 'staff.portrait'
export const TEACHER_PORTRAIT_PURPOSE = 'teacher.portrait'
export const PROFILE_PHOTO_PURPOSES = [
  STUDENT_PORTRAIT_PURPOSE,
  GUARDIAN_PORTRAIT_PURPOSE,
  STAFF_PORTRAIT_PURPOSE,
  TEACHER_PORTRAIT_PURPOSE,
] as const
export const STUDENT_PHOTO_CAPABILITY = 'capability.student-photo'
export const STUDENT_PHOTO_ABANDONED_MS = 24 * 60 * 60 * 1000
export const STUDENT_PHOTO_TERMINAL_RETAIN_MS = 30 * 24 * 60 * 60 * 1000

export type ProfilePhotoPurpose = typeof PROFILE_PHOTO_PURPOSES[number]

export function isProfilePhotoPurpose(purpose: string): purpose is ProfilePhotoPurpose {
  return (PROFILE_PHOTO_PURPOSES as readonly string[]).includes(purpose)
}

export function profilePhotoPurposeForOwner(ownerKind: AttachmentOwnerKind): ProfilePhotoPurpose {
  switch (ownerKind) {
    case AttachmentOwnerKind.Student:
      return STUDENT_PORTRAIT_PURPOSE
    case AttachmentOwnerKind.Guardian:
      return GUARDIAN_PORTRAIT_PURPOSE
    case AttachmentOwnerKind.Staff:
      return STAFF_PORTRAIT_PURPOSE
    case AttachmentOwnerKind.Teacher:
      return TEACHER_PORTRAIT_PURPOSE
    default:
      throw new BusinessRuleViolationError(
        'PROFILE_PHOTO_OWNER_NOT_ALLOWED',
        `Owner kind ${ownerKind} cannot receive a profile portrait`,
      )
  }
}

/** Parse a private content projection (`…/core/files/{id}/content`), never a signed URL. */
export function parseAttachmentIdFromContentUrl(url: string): string | undefined {
  const match = url.trim().match(/\/core\/files\/([^/?#]+)\/content(?:[?#]|$)/)
  const attachmentId = match?.[1]?.trim()
  return attachmentId || undefined
}
