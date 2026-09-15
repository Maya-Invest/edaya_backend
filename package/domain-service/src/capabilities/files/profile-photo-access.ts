import type { Attachment, ResourceAccessScope } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import type { AttachmentReadPolicy, AttachmentUploadPolicy } from './attachment-purpose-access'
import { denyResourceAccess } from '@edaya/authorization'
import {
  AttachmentOwnerKind,
  AttachmentStatus,
  BusinessRuleViolationError,
  isProfilePhotoPurpose,
  parseAttachmentIdFromContentUrl,
  PROFILE_PHOTO_JPEG_MIME,
  profilePhotoPurposeForOwner,
  resourceAccessScope,
  STUDENT_PORTRAIT_PURPOSE,
  StudentPhotoSubmissionStatus,
} from '@edaya/core'

export async function requireCurrentGuardianStudentLink(
  base: BaseSchoolService,
  guardianId: string,
  studentId: string,
) {
  const [guardian, student] = await Promise.all([
    base.entities.guardians.findById(guardianId),
    base.entities.students.findById(studentId),
  ])
  if (!guardian || !guardian.hasAccess || guardian.schoolId !== base.actor.schoolId)
    denyResourceAccess()
  if (!student || student.schoolId !== guardian.schoolId)
    denyResourceAccess()
  const links = await base.entities.guardianLinks.list({ guardianId, studentId })
  const link = links.find(row => row.schoolId === guardian.schoolId)
  if (!link)
    denyResourceAccess()
  return { guardian, student, link }
}

async function authorizeProfilePhotoOwner(
  base: BaseSchoolService,
  ownerKind: AttachmentOwnerKind,
  ownerId: string,
): Promise<void> {
  const actor = base.actor
  if (ownerKind === AttachmentOwnerKind.Student) {
    const student = await base.entities.students.findById(ownerId)
    if (!student || student.schoolId !== actor.schoolId)
      denyResourceAccess()
    if (actor.kind === 'guardian') {
      await requireCurrentGuardianStudentLink(base, actor.guardianId, ownerId)
      return
    }
    await base.access.entity('students').assertSave(student, student)
    return
  }
  if (ownerKind === AttachmentOwnerKind.Guardian) {
    const guardian = await base.entities.guardians.findById(ownerId)
    if (!guardian || guardian.schoolId !== actor.schoolId)
      denyResourceAccess()
    if (actor.kind === 'guardian' && actor.guardianId !== ownerId)
      denyResourceAccess()
    await base.access.entity('guardians').assertSave(guardian, guardian)
    return
  }
  if (ownerKind === AttachmentOwnerKind.Staff) {
    const staff = await base.entities.staffMembers.findById(ownerId)
    if (!staff || staff.schoolId !== actor.schoolId)
      denyResourceAccess()
    await base.access.entity('staffMembers').assertSave(staff, staff)
    return
  }
  denyResourceAccess()
}

function ownerAttachmentScope(
  schoolId: string,
  ownerKind: AttachmentOwnerKind,
  ownerId: string,
  purpose: string,
  attachmentIds?: readonly string[],
): ResourceAccessScope {
  const target = ownerKind === AttachmentOwnerKind.Student
    ? { kind: 'student' as const, studentId: ownerId }
    : { kind: 'records' as const, ids: [ownerId] }
  return resourceAccessScope(schoolId, 'attachments', [{
    target,
    attachmentOwners: [ownerKind],
    attachmentPurposes: [purpose],
    ...(attachmentIds ? { attachmentIds } : {}),
  }])
}

export async function profilePhotoUploadPolicy(
  base: BaseSchoolService,
  ownerKind: AttachmentOwnerKind,
  ownerId: string,
): Promise<AttachmentUploadPolicy> {
  const purpose = profilePhotoPurposeForOwner(ownerKind)
  return {
    purpose,
    allowedMimeTypes: [PROFILE_PHOTO_JPEG_MIME],
    maxBytes: base.profilePhotoMaxBytes,
    assertSave: async (attachment) => {
      if (attachment.ownerKind !== ownerKind || attachment.ownerId !== ownerId || attachment.purpose !== purpose)
        denyResourceAccess()
      await authorizeProfilePhotoOwner(base, ownerKind, ownerId)
      return ownerAttachmentScope(base.actor.schoolId, ownerKind, ownerId, purpose)
    },
  }
}

async function studentPortraitReadScope(base: BaseSchoolService, attachment: Attachment): Promise<ResourceAccessScope> {
  const student = await base.repositories.students.forSchool!(base.actor.schoolId).findById(attachment.ownerId)
  if (!student || student.schoolId !== base.actor.schoolId || attachment.ownerKind !== AttachmentOwnerKind.Student)
    denyResourceAccess()

  if (student.photoAttachmentId === attachment.id) {
    if (!await base.entities.students.findById(student.id))
      denyResourceAccess()
    return ownerAttachmentScope(base.actor.schoolId, AttachmentOwnerKind.Student, student.id, STUDENT_PORTRAIT_PURPOSE, [attachment.id])
  }

  const submissions = await base.repositories.studentPhotoSubmissions.forSchool!(base.actor.schoolId).list({
    studentId: student.id,
    attachmentId: attachment.id,
  })
  const submission = submissions[0]
  const actor = base.actor
  if (!submission) {
    if (actor.kind === 'guardian') {
      await requireCurrentGuardianStudentLink(base, actor.guardianId, student.id)
      if (attachment.uploadedById !== actor.actorId && attachment.uploadedById !== actor.guardianId)
        denyResourceAccess()
      return ownerAttachmentScope(base.actor.schoolId, AttachmentOwnerKind.Student, student.id, STUDENT_PORTRAIT_PURPOSE, [attachment.id])
    }
    await base.access.entity('students').assertSave(student, student)
    return ownerAttachmentScope(base.actor.schoolId, AttachmentOwnerKind.Student, student.id, STUDENT_PORTRAIT_PURPOSE, [attachment.id])
  }

  if (actor.kind === 'guardian' && actor.guardianId === submission.submitterGuardianId) {
    await requireCurrentGuardianStudentLink(base, actor.guardianId, student.id)
    return ownerAttachmentScope(base.actor.schoolId, AttachmentOwnerKind.Student, student.id, STUDENT_PORTRAIT_PURPOSE, [attachment.id])
  }
  if (submission.status === StudentPhotoSubmissionStatus.Pending) {
    await base.access.entity('students').assertSave(student, student)
    return ownerAttachmentScope(base.actor.schoolId, AttachmentOwnerKind.Student, student.id, STUDENT_PORTRAIT_PURPOSE, [attachment.id])
  }
  denyResourceAccess()
}

async function selfPortraitReadScope(base: BaseSchoolService, attachment: Attachment): Promise<ResourceAccessScope> {
  const purpose = profilePhotoPurposeForOwner(attachment.ownerKind)
  if (attachment.ownerKind === AttachmentOwnerKind.Guardian) {
    const guardian = await base.repositories.guardians.forSchool!(base.actor.schoolId).findById(attachment.ownerId)
    if (!guardian)
      denyResourceAccess()
    const publishedId = guardian.photoUrl ? parseAttachmentIdFromContentUrl(guardian.photoUrl) : undefined
    if (publishedId === attachment.id) {
      if (!await base.entities.guardians.findById(guardian.id))
        denyResourceAccess()
      return ownerAttachmentScope(base.actor.schoolId, attachment.ownerKind, attachment.ownerId, purpose, [attachment.id])
    }
  }
  if (attachment.ownerKind === AttachmentOwnerKind.Staff) {
    const staff = await base.repositories.staffMembers.forSchool!(base.actor.schoolId).findById(attachment.ownerId)
    if (!staff)
      denyResourceAccess()
    const publishedId = staff.photoUrl ? parseAttachmentIdFromContentUrl(staff.photoUrl) : undefined
    if (publishedId === attachment.id) {
      if (!await base.entities.staffMembers.findById(staff.id))
        denyResourceAccess()
      return ownerAttachmentScope(base.actor.schoolId, attachment.ownerKind, attachment.ownerId, purpose, [attachment.id])
    }
  }
  await authorizeProfilePhotoOwner(base, attachment.ownerKind, attachment.ownerId)
  return ownerAttachmentScope(base.actor.schoolId, attachment.ownerKind, attachment.ownerId, purpose, [attachment.id])
}

export function profilePhotoReadPolicy(base: BaseSchoolService, attachment: Attachment): AttachmentReadPolicy {
  const purpose = attachment.purpose
  if (!isProfilePhotoPurpose(purpose))
    denyResourceAccess()
  return {
    purpose,
    readScope: async () => {
      if (attachment.ownerKind === AttachmentOwnerKind.Student)
        return studentPortraitReadScope(base, attachment)
      return selfPortraitReadScope(base, attachment)
    },
  }
}

export async function assertImmediatePortraitPhotoUrl(
  base: BaseSchoolService,
  ownerKind: AttachmentOwnerKind,
  ownerId: string,
  photoUrl: string | null | undefined,
): Promise<void> {
  if (photoUrl === undefined)
    return
  if (!photoUrl)
    return
  const attachmentId = parseAttachmentIdFromContentUrl(photoUrl)
  if (!attachmentId)
    throw new BusinessRuleViolationError('PROFILE_PHOTO_URL_INVALID', 'Portrait URL must be a private content projection')
  const attachment = await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(attachmentId)
  const purpose = profilePhotoPurposeForOwner(ownerKind)
  if (!attachment
    || attachment.ownerKind !== ownerKind
    || attachment.ownerId !== ownerId
    || attachment.purpose !== purpose
    || attachment.status !== AttachmentStatus.Ready
    || attachment.mimeType !== PROFILE_PHOTO_JPEG_MIME
    || !attachment.sizeBytes
    || attachment.sizeBytes > base.profilePhotoMaxBytes) {
    throw new BusinessRuleViolationError('PROFILE_PHOTO_URL_INVALID', 'Portrait URL must reference this owner’s completed portrait')
  }
}

export async function resolveAttachmentReadPolicy(
  base: BaseSchoolService,
  attachmentId: string,
): Promise<AttachmentReadPolicy | undefined> {
  const attachment = await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(attachmentId)
  if (!attachment || !isProfilePhotoPurpose(attachment.purpose))
    return undefined
  return profilePhotoReadPolicy(base, attachment)
}
