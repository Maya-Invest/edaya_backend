import type { Assessment, AssessmentResult, Student } from '../../domains'
import type { WorkflowNotificationContext } from '../workflow-notification-runner'
import { resolveStudentAndAcademicGuardianRecipients } from '../recipient-resolvers'
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
