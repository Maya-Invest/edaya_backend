import type { ReportCardResult, Student } from '@edaya/core'
import type { WorkflowNotificationContext } from '../delivery/workflow-notification-runner'
import { deliverNotification } from '../delivery/deliver-notification'
import { resolveStudentAndAcademicGuardianRecipients } from '../delivery/recipient-resolvers'
import { formatPersonName } from '../templates/format-notification-variables'
import { renderNotificationEnqueueContent } from '../templates/render-enqueue-content'
import {
  resolveClassGroupName,
  resolvePeriodName,
} from '../templates/resolve-notification-labels'
import { resolveSchoolContext } from '../templates/resolve-school-context'

export const REPORT_CARD_PUBLISHED_EVENT_KEY = 'report_card.published'

export interface ReportCardPublishedPayload {
  result: ReportCardResult
  student: Student
  revisionId?: string
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

  const { schoolName } = await resolveSchoolContext(context.repositories, student.schoolId)
  const [periodName, classGroupName] = await Promise.all([
    resolvePeriodName(context.repositories, result.periodId),
    resolveClassGroupName(context.repositories, result.classGroupId),
  ])

  const content = await renderNotificationEnqueueContent(context.templateService, {
    schoolId: student.schoolId,
    templateKey: REPORT_CARD_PUBLISHED_EVENT_KEY,
    variables: {
      schoolName,
      studentName: formatPersonName(student.firstName, student.lastName),
      periodName,
      classGroupName,
    },
  })

  await deliverNotification({
    notificationGateway: context.notificationGateway,
    repositories: context.repositories,
  }, {
    schoolId: student.schoolId,
    kind: 'event',
    eventKey: REPORT_CARD_PUBLISHED_EVENT_KEY,
    idempotencyKeyPrefix: `${REPORT_CARD_PUBLISHED_EVENT_KEY}:${result.id}${payload.revisionId ? `:${payload.revisionId}` : ''}`,
    ...content,
    recipients,
    metadata: {
      reportCardResultId: result.id,
      studentId: student.id,
      periodId: result.periodId,
    },
  })
}
