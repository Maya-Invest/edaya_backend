import type { Student, StudentPhotoSubmission } from '@edaya/core'
import type { BaseSchoolService } from '../../../services/base-school-service'
import { MessageDeliveryRecipientKind } from '@edaya/core'
import { resolveGuardiansForStudents } from '../delivery/recipient-resolvers'
import { enqueueTemplatedNotification } from '../templates/enqueue-templated-notification'
import { formatPersonName } from '../templates/format-notification-variables'

export async function notifyStudentPhotoReviewed(
  base: BaseSchoolService,
  input: { submission: StudentPhotoSubmission, student: Student, approved: boolean },
): Promise<void> {
  const { submission, student, approved } = input
  const templateKey = approved ? 'student_photo.approved' : 'student_photo.rejected'
  const recipients = approved
    ? await resolveGuardiansForStudents(
        base.repositories,
        student.schoolId,
        [student.id],
        () => true,
        guardian => guardian.hasAccess,
      )
    : await resolveGuardiansForStudents(
        base.repositories,
        student.schoolId,
        [student.id],
        link => link.guardianId === submission.submitterGuardianId,
        guardian => guardian.id === submission.submitterGuardianId && guardian.hasAccess,
      )

  const submitterOnly = recipients.filter(recipient =>
    approved || (recipient.kind === MessageDeliveryRecipientKind.Guardian && recipient.id === submission.submitterGuardianId),
  )
  if (submitterOnly.length === 0)
    return

  await enqueueTemplatedNotification(base, {
    idempotencyKey: `${templateKey}:${submission.id}`,
    schoolId: student.schoolId,
    kind: 'event',
    eventKey: templateKey,
    templateKey,
    recipients: submitterOnly,
    variables: {
      studentName: formatPersonName(student.firstName, student.lastName),
      rejectionReason: submission.rejectionReason ?? '',
    },
    metadata: {
      route: '/child-profile',
      studentId: student.id,
      submissionId: submission.id,
    },
  })
}
