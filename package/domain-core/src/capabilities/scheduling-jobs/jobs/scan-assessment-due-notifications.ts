import type { Assessment } from '../../../domain'
import type { CronJobResult, SchoolCronJobContext } from '../cron-job-context'
import { enqueueTemplatedNotification } from '../../../capabilities/notifications/templates/enqueue-templated-notification'
import { resolveSchoolName } from '../../../capabilities/notifications/templates/resolve-school-name'
import {
  ASSESSMENT_DUE_SOON_EVENT_KEY,
  assessmentDueSoonDeliverAfter,
  assessmentDueSoonIdempotencyKey,
} from '../../../capabilities/notifications/triggers/assessment-due-soon'
import { MessageDeliveryRecipientKind, StudentClassEnrollmentStatus } from '../../../domain'
import { isInJobNotificationWindow } from '../due-window'

export async function scanAssessmentDueNotifications(
  context: SchoolCronJobContext,
): Promise<CronJobResult> {
  const assessments = await context.service.baseService.repositories.assessments.list({})
  let processed = 0
  let skipped = 0

  for (const assessment of assessments) {
    if (!shouldNotifyAssessmentDueSoon(assessment, context.asOf)) {
      skipped += 1
      continue
    }

    const classGroup = await context.service.baseService.repositories.classGroups.findById(assessment.classGroupId)
    if (!classGroup || classGroup.schoolId !== context.actor.schoolId) {
      skipped += 1
      continue
    }

    const enrollments = await context.service.baseService.repositories.enrollments.list({
      classGroupId: assessment.classGroupId,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (enrollments.length === 0) {
      skipped += 1
      continue
    }

    const schoolName = await resolveSchoolName(
      context.service.baseService.repositories,
      classGroup.schoolId,
    )
    await enqueueTemplatedNotification(context.service.baseService, {
      idempotencyKey: assessmentDueSoonIdempotencyKey(assessment.id),
      schoolId: classGroup.schoolId,
      kind: 'job',
      eventKey: ASSESSMENT_DUE_SOON_EVENT_KEY,
      templateKey: ASSESSMENT_DUE_SOON_EVENT_KEY,
      variables: {
        schoolName,
        assessmentTitle: assessment.title,
        dueDate: assessment.dueAt!.toISOString().slice(0, 10),
      },
      recipients: enrollments.map(enrollment => ({
        kind: MessageDeliveryRecipientKind.Student,
        id: enrollment.studentId,
      })),
      deliverAfter: assessmentDueSoonDeliverAfter(assessment.dueAt!),
      metadata: {
        assessmentId: assessment.id,
        classGroupId: assessment.classGroupId,
      },
    })
    processed += 1
  }

  return { processed, skipped }
}

function shouldNotifyAssessmentDueSoon(assessment: Assessment, asOf: Date): boolean {
  if (!assessment.dueAt || assessment.metAt) {
    return false
  }
  return isInJobNotificationWindow(
    assessmentDueSoonDeliverAfter(assessment.dueAt),
    assessment.dueAt,
    asOf,
  )
}
