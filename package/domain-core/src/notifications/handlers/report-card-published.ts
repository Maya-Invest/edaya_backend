import type { ReportCardResult, Student } from '../../domains'
import type { WorkflowNotificationContext } from '../workflow-notification-runner'
import { MessageDeliveryRecipientKind } from '../../domains'
import { uniqueNotificationRecipients } from '../recipient-utils'

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

  const recipients = uniqueNotificationRecipients([
    { kind: MessageDeliveryRecipientKind.Student, id: student.id },
    ...(await resolveGuardianRecipients(context, student.id, student.schoolId)),
  ])

  if (recipients.length === 0) {
    return
  }

  await context.notificationGateway.enqueue({
    idempotencyKey: `${REPORT_CARD_PUBLISHED_EVENT_KEY}:${result.id}`,
    schoolId: student.schoolId,
    kind: 'event',
    eventKey: REPORT_CARD_PUBLISHED_EVENT_KEY,
    title: 'Report card published',
    body: `The report card for ${student.firstName} ${student.lastName} is now available.`,
    recipients,
    metadata: {
      reportCardResultId: result.id,
      studentId: student.id,
      periodId: result.periodId,
    },
  })
}

async function resolveGuardianRecipients(
  context: WorkflowNotificationContext,
  studentId: string,
  schoolId: string,
) {
  const links = await context.repositories.guardianLinks.list({ studentId })
  const recipients: Array<{ kind: MessageDeliveryRecipientKind, id: string }> = []

  for (const link of links) {
    if (!link.receivesAcademicReports) {
      continue
    }
    const guardian = await context.repositories.guardians.findById(link.guardianId)
    if (!guardian || guardian.schoolId !== schoolId) {
      continue
    }
    recipients.push({
      kind: MessageDeliveryRecipientKind.Guardian,
      id: guardian.id,
    })
  }

  return recipients
}
