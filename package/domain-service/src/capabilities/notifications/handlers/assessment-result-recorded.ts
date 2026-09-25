import type { Assessment, AssessmentResult, Student } from '@edaya/core'
import type { WorkflowNotificationContext } from '../delivery/workflow-notification-runner'
import { deliverNotification } from '../delivery/deliver-notification'
import { resolveStudentAndAcademicGuardianRecipients } from '../delivery/recipient-resolvers'
import {
  formatPersonName,
  formatScoreDisplay,
} from '../templates/format-notification-variables'
import { renderNotificationEnqueueContent } from '../templates/render-enqueue-content'
import {
  resolvePeriodName,
  resolveSubjectNameFromClassSubject,
} from '../templates/resolve-notification-labels'
import { resolveSchoolContext } from '../templates/resolve-school-context'

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
  if (student.schoolId !== context.actor.schoolId || assessment.marksStatus !== 'approved') {
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
  const [subjectName, periodName] = await Promise.all([
    resolveSubjectNameFromClassSubject(context.repositories, assessment.classSubjectId),
    resolvePeriodName(context.repositories, assessment.periodId),
  ])

  const content = await renderNotificationEnqueueContent(context.templateService, {
    schoolId: student.schoolId,
    templateKey: ASSESSMENT_RESULT_RECORDED_EVENT_KEY,
    variables: {
      schoolName,
      studentName: formatPersonName(student.firstName, student.lastName),
      assessmentTitle: assessment.title,
      subjectName,
      periodName,
      score: result.score === undefined ? '' : String(result.score),
      maxScore: String(assessment.maxScore),
      scoreDisplay: formatScoreDisplay(result.score, assessment.maxScore),
    },
  })

  await deliverNotification({
    notificationGateway: context.notificationGateway,
    repositories: context.repositories,
  }, {
    schoolId: student.schoolId,
    kind: 'event',
    eventKey: ASSESSMENT_RESULT_RECORDED_EVENT_KEY,
    idempotencyKeyPrefix: `${ASSESSMENT_RESULT_RECORDED_EVENT_KEY}:${result.id}:${assessment.marksRevision}`,
    ...content,
    recipients,
    metadata: {
      assessmentResultId: result.id,
      assessmentId: assessment.id,
      marksRevision: String(assessment.marksRevision),
      studentId: student.id,
      score: result.score === undefined ? '' : String(result.score),
    },
  })
}
