import type { ReportCardResult, Student } from '../../domains'
import type { WorkflowNotificationContext } from '../workflow-notification-runner'
import { resolveStudentAndAcademicGuardianRecipients } from '../recipient-resolvers'
import { renderNotificationEnqueueContent } from '../templates/render-enqueue-content'
import { resolveSchoolName } from '../templates/resolve-school-name'

export const REPORT_CARD_PUBLISHED_EVENT_KEY = 'report_card.published'

export interface ReportCardPublishedPayload {
  result: ReportCardResult
  student: Student
}

export async function handleReportCardPublished(
  context: WorkflowNotificationContext,
  payload: ReportCardPublishedPayload,
): Promise<void> {
  const { result, student } = payload
  if (student.schoolId !== context.actor.schoolId) {
    return
  }

  const recipients = await resolveStudentAndAcademicGuardianRecipients(
    context.repositories,
    student.schoolId,
    student.id,
  )

  if (recipients.length === 0) {
    return
  }

  const schoolName = await resolveSchoolName(context.repositories, student.schoolId)
  const content = await renderNotificationEnqueueContent(context.templateService, {
    schoolId: student.schoolId,
    templateKey: REPORT_CARD_PUBLISHED_EVENT_KEY,
    variables: {
      schoolName,
      studentName: `${student.firstName} ${student.lastName}`,
    },
  })

  await context.notificationGateway.enqueue({
    idempotencyKey: `${REPORT_CARD_PUBLISHED_EVENT_KEY}:${result.id}`,
    schoolId: student.schoolId,
    kind: 'event',
    eventKey: REPORT_CARD_PUBLISHED_EVENT_KEY,
    ...content,
    recipients,
    metadata: {
      reportCardResultId: result.id,
      studentId: student.id,
      periodId: result.periodId,
    },
  })
}
