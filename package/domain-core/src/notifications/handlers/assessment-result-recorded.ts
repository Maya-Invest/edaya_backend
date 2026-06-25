import type { Assessment, AssessmentResult, Student } from '../../domains'
import type { WorkflowNotificationContext } from '../workflow-notification-runner'
import { MessageDeliveryRecipientKind } from '../../domains'
import { uniqueNotificationRecipients } from '../recipient-utils'
import { renderNotificationEnqueueContent } from '../templates/render-enqueue-content'
import { resolveSchoolName } from '../templates/resolve-school-name'

export const ASSESSMENT_RESULT_RECORDED_EVENT_KEY = 'assessment.result_recorded'

export interface AssessmentResultRecordedPayload {
  result: AssessmentResult
  assessment: Assessment
  student: Student
}

export async function handleAssessmentResultRecorded(
  context: WorkflowNotificationContext,
  payload: AssessmentResultRecordedPayload,
): Promise<void> {
  const { result, assessment, student } = payload
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

  const schoolName = await resolveSchoolName(context.repositories, student.schoolId)
  const content = await renderNotificationEnqueueContent(context.templateService, {
    schoolId: student.schoolId,
    templateKey: ASSESSMENT_RESULT_RECORDED_EVENT_KEY,
    variables: {
      schoolName,
      assessmentTitle: assessment.title,
    },
  })

  await context.notificationGateway.enqueue({
    idempotencyKey: `${ASSESSMENT_RESULT_RECORDED_EVENT_KEY}:${result.id}`,
    schoolId: student.schoolId,
    kind: 'event',
    eventKey: ASSESSMENT_RESULT_RECORDED_EVENT_KEY,
    ...content,
    recipients,
    metadata: {
      assessmentResultId: result.id,
      assessmentId: assessment.id,
      studentId: student.id,
      score: result.score === undefined ? '' : String(result.score),
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
