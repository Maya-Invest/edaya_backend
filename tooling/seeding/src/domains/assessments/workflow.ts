import type { AssessmentsSeedPort } from './port'
import { AssessmentKind, buildInClassAssessmentWindow, DeadlineComplianceStatus } from '@edaya/core'
import {
  SEED_ASSESSMENT_RESULT_SCORES,
  SEED_ASSESSMENTS,
  SEED_HOMEWORK_ASSIGNMENTS,
  SEED_HOMEWORK_SUBMISSIONS,
  seedPeriodIdForDate,
} from '@edaya/fixtures'
import { seedDateTime } from '../../support/seed-date'

const ASSESSMENT_KIND_BY_SEED = {
  quiz: AssessmentKind.Quiz,
  homework: AssessmentKind.Homework,
  project: AssessmentKind.Project,
  other: AssessmentKind.Other,
} as const

const HOMEWORK_KIND_BY_SEED = {
  homework: AssessmentKind.Homework,
  project: AssessmentKind.Homework,
  reading: AssessmentKind.Homework,
  lab: AssessmentKind.Homework,
} as const

const SUBMISSION_STATUS_BY_SEED = {
  submitted: DeadlineComplianceStatus.Met,
  late: DeadlineComplianceStatus.Late,
  missing: DeadlineComplianceStatus.Missed,
} as const

export async function seedDevAssessments(port: AssessmentsSeedPort): Promise<void> {
  for (const assessment of SEED_ASSESSMENTS) {
    const assessmentDate = seedDateTime(assessment.date)
    const { startsAt, endsAt } = buildInClassAssessmentWindow(new Date(assessmentDate))
    await port.createAssessment({
      id: assessment.id,
      classGroupId: assessment.classGroupId,
      classSubjectId: assessment.classSubjectId,
      periodId: seedPeriodIdForDate(assessment.date),
      title: assessment.title,
      kind: ASSESSMENT_KIND_BY_SEED[assessment.kind],
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    })

    const scores = SEED_ASSESSMENT_RESULT_SCORES[assessment.id] ?? {}
    for (const [studentId, score] of Object.entries(scores)) {
      if (score === undefined) {
        continue
      }
      await port.recordAssessmentResult({
        id: `ar-${assessment.id}-${studentId}`,
        assessmentId: assessment.id,
        studentId,
        score,
      })
    }
  }

  for (const assignment of SEED_HOMEWORK_ASSIGNMENTS) {
    await port.createAssessment({
      id: assignment.id,
      classGroupId: assignment.classGroupId,
      classSubjectId: assignment.classSubjectId,
      periodId: seedPeriodIdForDate(assignment.dueDate),
      title: assignment.title,
      kind: HOMEWORK_KIND_BY_SEED[assignment.type],
      maxScore: 20,
      coefficient: 1,
      description: assignment.description,
      attachments: assignment.attachments.map(attachment => ({ ...attachment })),
      dueAt: seedDateTime(assignment.dueDate),
    })
  }

  for (const submission of SEED_HOMEWORK_SUBMISSIONS) {
    await port.recordAssessmentResult({
      id: submission.id,
      assessmentId: submission.homeworkAssignmentId,
      studentId: submission.studentId,
      status: SUBMISSION_STATUS_BY_SEED[submission.status],
    })
  }
}
