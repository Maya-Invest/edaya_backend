import type { Attachment } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import {
  AttachmentOwnerKind,
  BusinessRuleViolationError,
  STUDENT_PHOTO_ABANDONED_MS,
  STUDENT_PHOTO_CAPABILITY,
  STUDENT_PHOTO_TERMINAL_RETAIN_MS,
  STUDENT_PORTRAIT_PURPOSE,
} from '@edaya/core'

export async function retainUnsubmittedStudentPortrait(base: BaseSchoolService, attachment: Attachment): Promise<void> {
  if (attachment.purpose !== STUDENT_PORTRAIT_PURPOSE || !attachment.storageKey)
    return
  await base.repositories.privateFiles.reserve({
    schoolId: attachment.schoolId,
    storageKey: attachment.storageKey,
    protectedUntil: new Date(Date.now() + STUDENT_PHOTO_ABANDONED_MS),
  })
}

export async function retainPendingStudentPortrait(
  base: BaseSchoolService,
  submissionId: string,
  attachment: Attachment,
): Promise<void> {
  await base.repositories.privateFiles.retain({
    schoolId: attachment.schoolId,
    sourceType: STUDENT_PHOTO_CAPABILITY,
    sourceId: submissionId,
    slot: 'pending',
    attachmentId: attachment.id,
    storageKey: attachment.storageKey,
  })
}

export async function releasePendingStudentPortrait(
  base: BaseSchoolService,
  schoolId: string,
  submissionId: string,
  proposal?: { storageKey?: string, attachmentId?: string },
): Promise<void> {
  await base.repositories.privateFiles.release({
    schoolId,
    sourceType: STUDENT_PHOTO_CAPABILITY,
    sourceId: submissionId,
    slot: 'pending',
  })
  if (proposal?.storageKey) {
    await base.repositories.privateFiles.reserve({
      schoolId,
      storageKey: proposal.storageKey,
      protectedUntil: new Date(Date.now() + STUDENT_PHOTO_TERMINAL_RETAIN_MS),
    })
  }
  await detachUnreferencedStudentPortrait(base, proposal?.attachmentId)
}

export async function retainPublishedStudentPortrait(
  base: BaseSchoolService,
  studentId: string,
  attachment: Attachment,
  previous?: Attachment,
): Promise<void> {
  await base.repositories.privateFiles.retain({
    schoolId: attachment.schoolId,
    sourceType: STUDENT_PHOTO_CAPABILITY,
    sourceId: studentId,
    slot: 'published',
    attachmentId: attachment.id,
    storageKey: attachment.storageKey,
  })
  if (previous && previous.id !== attachment.id) {
    if (previous.storageKey) {
      await base.repositories.privateFiles.reserve({
        schoolId: attachment.schoolId,
        storageKey: previous.storageKey,
        protectedUntil: new Date(Date.now() + STUDENT_PHOTO_TERMINAL_RETAIN_MS),
      })
    }
    await detachUnreferencedStudentPortrait(base, previous.id)
  }
}

/** Drop proposal metadata so object cleanup can run after the 24h/30d window. Keep submission audit rows. */
export async function detachUnreferencedStudentPortrait(
  base: BaseSchoolService,
  attachmentId: string | undefined,
): Promise<boolean> {
  if (!attachmentId)
    return false
  const attachment = await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(attachmentId)
  if (!attachment || attachment.purpose !== STUDENT_PORTRAIT_PURPOSE || attachment.ownerKind !== AttachmentOwnerKind.Student)
    return false
  const student = await base.repositories.students.forSchool!(base.actor.schoolId).findById(attachment.ownerId)
  if (student?.photoAttachmentId === attachment.id)
    return false
  try {
    await base.repositories.privateFiles.assertRemovable(attachment.schoolId, attachment.id)
  }
  catch (error) {
    if (error instanceof BusinessRuleViolationError && error.code === 'ATTACHMENT_REFERENCED')
      return false
    throw error
  }
  await base.repositories.attachments.forSchool!(attachment.schoolId).delete(attachment.id)
  return true
}

/** 24h abandoned unsubmitted student portraits only. Terminal proposals are detached at reject/withdraw/supersede/replace. */
export async function sweepExpiredStudentPortraitAttachments(
  base: BaseSchoolService,
  asOf: Date,
): Promise<{ processed: number, skipped: number }> {
  await base.access.attachments.assertCleanup()
  const portraits = await base.repositories.privateFiles.listAbandonedPortraitIds(base.actor.schoolId, asOf)
  let processed = 0
  let skipped = 0
  for (const attachmentId of portraits) {
    if (await detachUnreferencedStudentPortrait(base, attachmentId))
      processed++
    else
      skipped++
  }
  return { processed, skipped }
}
