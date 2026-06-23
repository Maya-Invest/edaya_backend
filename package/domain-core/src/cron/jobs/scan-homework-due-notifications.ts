import type { HomeworkAssignment } from '../../domains'
import type { CronJobResult, SchoolCronJobContext } from '../cron-job-context'
import { resolveClassGroupStudentAndGuardianRecipients } from '../../notifications/recipient-resolvers'
import {
  HOMEWORK_DUE_SOON_EVENT_KEY,
  homeworkDueSoonDeliverAfter,
  homeworkDueSoonIdempotencyKey,
} from '../../notifications/triggers/homework-due-soon'
import { isInJobNotificationWindow } from '../due-window'

export async function scanHomeworkDueNotifications(
  context: SchoolCronJobContext,
): Promise<CronJobResult> {
  const assignments = await context.service.baseService.repositories.homeworkAssignments.list({})
  let processed = 0
  let skipped = 0

  for (const assignment of assignments) {
    if (!shouldNotifyHomeworkDueSoon(assignment, context.asOf)) {
      skipped += 1
      continue
    }

    if (assignment.schoolId !== context.actor.schoolId) {
      skipped += 1
      continue
    }

    const recipients = await resolveClassGroupStudentAndGuardianRecipients(
      context.service.baseService.repositories,
      assignment.schoolId,
      assignment.classGroupId,
      link => link.receivesAcademicReports,
    )
    if (recipients.length === 0) {
      skipped += 1
      continue
    }

    await context.service.baseService.notificationGateway.enqueue({
      idempotencyKey: homeworkDueSoonIdempotencyKey(assignment.id),
      schoolId: assignment.schoolId,
      kind: 'job',
      eventKey: HOMEWORK_DUE_SOON_EVENT_KEY,
      title: `Homework due soon: ${assignment.title}`,
      body: `${assignment.title} is due on ${assignment.dueDate.toISOString().slice(0, 10)}.`,
      recipients,
      deliverAfter: homeworkDueSoonDeliverAfter(assignment.dueDate),
      metadata: {
        homeworkAssignmentId: assignment.id,
        classGroupId: assignment.classGroupId,
      },
    })
    processed += 1
  }

  return { processed, skipped }
}

function shouldNotifyHomeworkDueSoon(assignment: HomeworkAssignment, asOf: Date): boolean {
  return isInJobNotificationWindow(
    homeworkDueSoonDeliverAfter(assignment.dueDate),
    assignment.dueDate,
    asOf,
  )
}
