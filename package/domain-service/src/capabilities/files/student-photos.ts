import type { Attachment, Student, StudentPhotoSubmission } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { denyResourceAccess, resolveAuditActorId } from '@edaya/authorization'
import {
  AttachmentOwnerKind,
  AttachmentStatus,
  BusinessRuleViolationError,
  PROFILE_PHOTO_JPEG_MIME,
  STUDENT_PORTRAIT_PURPOSE,
  StudentPhotoSubmission as StudentPhotoSubmissionEntity,
  StudentPhotoSubmissionStatus,
} from '@edaya/core'
import { schoolCommandScope } from '../../services/commands/school-command-scope'
import { notifyStudentPhotoReviewed } from '../notifications/handlers/student-photo-reviewed'
import { requireCurrentGuardianStudentLink } from './profile-photo-access'
import {
  releasePendingStudentPortrait,
  retainPendingStudentPortrait,
  retainPublishedStudentPortrait,
} from './student-photo-lifecycle'

function fail(code: string, message: string): never {
  throw new BusinessRuleViolationError(code, message)
}

function lock(studentId: string) {
  return { lockKeys: [`student-photo:${studentId}`] }
}

async function requireReadyStudentPortrait(
  base: BaseSchoolService,
  studentId: string,
  attachmentId: string,
): Promise<Attachment> {
  const attachment = await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(attachmentId)
  if (!attachment
    || attachment.schoolId !== base.actor.schoolId
    || attachment.ownerKind !== AttachmentOwnerKind.Student
    || attachment.ownerId !== studentId
    || attachment.purpose !== STUDENT_PORTRAIT_PURPOSE
    || attachment.status !== AttachmentStatus.Ready
    || attachment.mimeType !== PROFILE_PHOTO_JPEG_MIME
    || !attachment.sizeBytes
    || attachment.sizeBytes > base.profilePhotoMaxBytes
    || !attachment.storageKey) {
    fail('STUDENT_PHOTO_ATTACHMENT_INVALID', 'A completed student portrait upload is required')
  }
  return attachment
}

async function loadSubmission(base: BaseSchoolService, submissionId: string): Promise<StudentPhotoSubmission> {
  const submission = await base.repositories.studentPhotoSubmissions.forSchool!(base.actor.schoolId).findById(submissionId)
  if (!submission)
    fail('STUDENT_PHOTO_RESULT_UNAVAILABLE', 'The photo submission is no longer available')
  return submission
}

async function pendingForStudent(base: BaseSchoolService, studentId: string): Promise<StudentPhotoSubmission | undefined> {
  const [pending] = await base.repositories.studentPhotoSubmissions.forSchool!(base.actor.schoolId).list({
    studentId,
    status: StudentPhotoSubmissionStatus.Pending,
    $limit: 1,
  })
  return pending
}

function publishedStudent(student: Student, attachment: Attachment): Student {
  return student.copyWith({
    photoAttachmentId: attachment.id,
    photoUrl: `/core/files/${attachment.id}/content`,
  })
}

export interface SubmitStudentPhotoInput {
  requestId: string
  studentId: string
  attachmentId: string
}

export async function submitStudentPhoto(base: BaseSchoolService, input: SubmitStudentPhotoInput): Promise<StudentPhotoSubmission> {
  if (base.actor.kind !== 'guardian')
    denyResourceAccess()
  const guardianId = base.actor.guardianId
  return base.commandExecution.execute({
    scope: await schoolCommandScope(base.actor, 'submitStudentPhoto', input.requestId),
    input: { requestId: input.requestId, studentId: input.studentId, attachmentId: input.attachmentId },
    resultMode: 'ordinary',
    ...lock(input.studentId),
    authorize: async () => {
      await requireCurrentGuardianStudentLink(base, guardianId, input.studentId)
      await requireReadyStudentPortrait(base, input.studentId, input.attachmentId)
    },
    execute: async () => {
      const { student } = await requireCurrentGuardianStudentLink(base, guardianId, input.studentId)
      const attachment = await requireReadyStudentPortrait(base, input.studentId, input.attachmentId)
      if (student.photoAttachmentId === attachment.id)
        fail('STUDENT_PHOTO_ALREADY_PUBLISHED', 'This portrait is already published')
      const pending = await pendingForStudent(base, input.studentId)
      if (pending) {
        if (pending.attachmentId === attachment.id && pending.submitterGuardianId === guardianId)
          return pending
        const superseded = pending.copyWith({
          status: StudentPhotoSubmissionStatus.Superseded,
          updatedAt: new Date(),
        })
        await base.entities.studentPhotoSubmissions.save(superseded)
        const previous = await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(superseded.attachmentId)
        await releasePendingStudentPortrait(
          base,
          superseded.schoolId,
          superseded.id,
          previous && previous.id !== attachment.id
            ? { storageKey: previous.storageKey, attachmentId: previous.id }
            : undefined,
        )
      }
      const submission = new StudentPhotoSubmissionEntity({
        id: `sps-${crypto.randomUUID()}`,
        schoolId: student.schoolId,
        studentId: student.id,
        attachmentId: attachment.id,
        submitterGuardianId: guardianId,
        status: StudentPhotoSubmissionStatus.Pending,
        version: pending ? pending.version + 1 : 1,
      })
      await base.entities.studentPhotoSubmissions.save(submission)
      await retainPendingStudentPortrait(base, submission.id, attachment)
      return submission
    },
    replay: async (stored: { submissionId: string }) => {
      const submission = await loadSubmission(base, stored.submissionId)
      await requireCurrentGuardianStudentLink(base, guardianId, submission.studentId)
      return submission
    },
    persistResult: result => ({ submissionId: result.id }),
    audit: result => [{ event: 'student_photo.submitted', resourceType: 'student-photo-submission', resourceId: result.id }],
  })
}

export interface WithdrawStudentPhotoSubmissionInput {
  requestId: string
  submissionId: string
  expectedVersion: number
}

export async function withdrawStudentPhotoSubmission(
  base: BaseSchoolService,
  input: WithdrawStudentPhotoSubmissionInput,
): Promise<StudentPhotoSubmission> {
  if (base.actor.kind !== 'guardian')
    denyResourceAccess()
  const guardianId = base.actor.guardianId
  const existing = await base.repositories.studentPhotoSubmissions.forSchool!(base.actor.schoolId).findById(input.submissionId)
  if (!existing || existing.submitterGuardianId !== guardianId)
    denyResourceAccess()
  return base.commandExecution.execute({
    scope: await schoolCommandScope(base.actor, 'withdrawStudentPhotoSubmission', input.requestId),
    input: { requestId: input.requestId, submissionId: input.submissionId, expectedVersion: input.expectedVersion },
    resultMode: 'ordinary',
    ...lock(existing.studentId),
    authorize: async () => {
      await requireCurrentGuardianStudentLink(base, existing.submitterGuardianId, existing.studentId)
    },
    execute: async () => {
      const submission = await loadSubmission(base, input.submissionId)
      if (!submission.isPending)
        fail('STUDENT_PHOTO_NOT_PENDING', 'Only a pending submission can be withdrawn')
      if (submission.version !== input.expectedVersion)
        fail('STUDENT_PHOTO_VERSION_CONFLICT', 'The submission was changed')
      const withdrawn = submission.copyWith({
        status: StudentPhotoSubmissionStatus.Withdrawn,
        updatedAt: new Date(),
      })
      await base.entities.studentPhotoSubmissions.save(withdrawn)
      const attachment = await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(withdrawn.attachmentId)
      await releasePendingStudentPortrait(
        base,
        withdrawn.schoolId,
        withdrawn.id,
        attachment ? { storageKey: attachment.storageKey, attachmentId: attachment.id } : undefined,
      )
      return withdrawn
    },
    replay: async (stored: { submissionId: string }) => {
      const submission = await loadSubmission(base, stored.submissionId)
      if (submission.submitterGuardianId !== guardianId)
        denyResourceAccess()
      await requireCurrentGuardianStudentLink(base, submission.submitterGuardianId, submission.studentId)
      return submission
    },
    persistResult: result => ({ submissionId: result.id }),
    audit: result => [{ event: 'student_photo.withdrawn', resourceType: 'student-photo-submission', resourceId: result.id }],
  })
}

export interface ReviewStudentPhotoInput {
  requestId: string
  submissionId: string
  expectedVersion: number
  decision: 'approve' | 'reject'
  rejectionReason?: string
}

export async function reviewStudentPhoto(base: BaseSchoolService, input: ReviewStudentPhotoInput): Promise<StudentPhotoSubmission> {
  const existing = await base.entities.studentPhotoSubmissions.findById(input.submissionId)
  if (!existing)
    denyResourceAccess()
  return base.commandExecution.execute({
    scope: await schoolCommandScope(base.actor, 'reviewStudentPhoto', input.requestId),
    input: {
      requestId: input.requestId,
      submissionId: input.submissionId,
      expectedVersion: input.expectedVersion,
      decision: input.decision,
      rejectionReason: input.rejectionReason,
    },
    resultMode: 'ordinary',
    ...lock(existing.studentId),
    authorize: async () => {
      const submission = await base.entities.studentPhotoSubmissions.findById(input.submissionId)
      if (!submission)
        denyResourceAccess()
      const student = await base.entities.students.findById(submission.studentId)
      if (!student)
        denyResourceAccess()
      await base.access.entity('students').assertSave(student, student)
      if (input.decision === 'reject' && !input.rejectionReason?.trim())
        fail('STUDENT_PHOTO_REJECTION_REASON_REQUIRED', 'A rejection reason is required')
    },
    execute: async () => {
      const submission = await base.entities.studentPhotoSubmissions.findById(input.submissionId)
      if (!submission)
        denyResourceAccess()
      if (!submission.isPending)
        fail('STUDENT_PHOTO_NOT_PENDING', 'Only a pending submission can be reviewed')
      if (submission.version !== input.expectedVersion)
        fail('STUDENT_PHOTO_VERSION_CONFLICT', 'The submission was changed')
      const student = await base.entities.students.findById(submission.studentId)
      if (!student)
        denyResourceAccess()
      const now = new Date()
      const reviewerStaffId = resolveAuditActorId(base.actor)
      if (input.decision === 'reject') {
        const rejected = submission.copyWith({
          status: StudentPhotoSubmissionStatus.Rejected,
          reviewerStaffId,
          reviewedAt: now,
          rejectionReason: input.rejectionReason!.trim(),
          updatedAt: now,
        })
        await base.entities.studentPhotoSubmissions.save(rejected)
        const attachment = await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(rejected.attachmentId)
        await releasePendingStudentPortrait(
          base,
          rejected.schoolId,
          rejected.id,
          attachment ? { storageKey: attachment.storageKey, attachmentId: attachment.id } : undefined,
        )
        await notifyStudentPhotoReviewed(base, { submission: rejected, student, approved: false })
        return rejected
      }
      const attachment = await requireReadyStudentPortrait(base, student.id, submission.attachmentId)
      const previous = student.photoAttachmentId
        ? await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(student.photoAttachmentId)
        : undefined
      const approved = submission.copyWith({
        status: StudentPhotoSubmissionStatus.Approved,
        reviewerStaffId,
        reviewedAt: now,
        updatedAt: now,
      })
      await base.entities.studentPhotoSubmissions.save(approved)
      await base.entities.students.save(publishedStudent(student, attachment))
      await retainPublishedStudentPortrait(base, student.id, attachment, previous)
      await releasePendingStudentPortrait(base, approved.schoolId, approved.id, undefined)
      await notifyStudentPhotoReviewed(base, { submission: approved, student, approved: true })
      return approved
    },
    replay: async (stored: { submissionId: string }) => {
      return loadSubmission(base, stored.submissionId)
    },
    persistResult: result => ({ submissionId: result.id }),
    audit: result => [{
      event: result.status === StudentPhotoSubmissionStatus.Approved ? 'student_photo.approved' : 'student_photo.rejected',
      resourceType: 'student-photo-submission',
      resourceId: result.id,
    }],
  })
}

export interface PublishStudentPhotoInput {
  requestId: string
  studentId: string
  attachmentId: string
}

export async function publishStudentPhoto(base: BaseSchoolService, input: PublishStudentPhotoInput): Promise<Student> {
  return base.commandExecution.execute({
    scope: await schoolCommandScope(base.actor, 'publishStudentPhoto', input.requestId),
    input: { requestId: input.requestId, studentId: input.studentId, attachmentId: input.attachmentId },
    resultMode: 'ordinary',
    ...lock(input.studentId),
    authorize: async () => {
      const student = await base.entities.students.findById(input.studentId)
      if (!student)
        denyResourceAccess()
      await base.access.entity('students').assertSave(student, student)
      await requireReadyStudentPortrait(base, input.studentId, input.attachmentId)
    },
    execute: async () => {
      const student = await base.entities.students.findById(input.studentId)
      if (!student)
        denyResourceAccess()
      const attachment = await requireReadyStudentPortrait(base, input.studentId, input.attachmentId)
      const pending = await pendingForStudent(base, input.studentId)
      if (pending) {
        const superseded = pending.copyWith({
          status: StudentPhotoSubmissionStatus.Superseded,
          reviewerStaffId: resolveAuditActorId(base.actor),
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        await base.entities.studentPhotoSubmissions.save(superseded)
        const previous = await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(superseded.attachmentId)
        await releasePendingStudentPortrait(
          base,
          superseded.schoolId,
          superseded.id,
          previous && previous.id !== attachment.id
            ? { storageKey: previous.storageKey, attachmentId: previous.id }
            : undefined,
        )
      }
      const previous = student.photoAttachmentId
        ? await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(student.photoAttachmentId)
        : undefined
      const published = publishedStudent(student, attachment)
      await base.entities.students.save(published)
      await retainPublishedStudentPortrait(base, student.id, attachment, previous)
      return published
    },
    replay: async (stored: { studentId: string }) => {
      const student = await base.entities.students.findById(stored.studentId)
      if (!student)
        fail('STUDENT_PHOTO_RESULT_UNAVAILABLE', 'The published student is no longer available')
      return student
    },
    persistResult: result => ({ studentId: result.id, photoAttachmentId: result.photoAttachmentId ?? null }),
    audit: result => [{ event: 'student_photo.published', resourceType: 'student', resourceId: result.id }],
  })
}
