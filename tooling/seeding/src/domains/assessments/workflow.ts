import type { AssessmentsSeedPort } from './port'
import { AssessmentKind } from '@edaya/core'
import {
  SEED_ASSESSMENT_RESULT_SCORES,
  SEED_ASSESSMENTS,
  seedPeriodIdForDate,
} from '@edaya/dev-fixtures'
import { seedDateTime } from '../../support/seed-date'

const ASSESSMENT_KIND_BY_SEED = {
  quiz: AssessmentKind.Quiz,
  homework: AssessmentKind.Homework,
  project: AssessmentKind.Project,
  other: AssessmentKind.Other,
} as const

export async function seedDevAssessments(port: AssessmentsSeedPort): Promise<void> {
  for (const assessment of SEED_ASSESSMENTS) {
    const assessmentDate = seedDateTime(assessment.date)
    await port.createAssessment({
      id: assessment.id,
      classGroupId: assessment.classGroupId,
      classSubjectId: assessment.classSubjectId,
      periodId: seedPeriodIdForDate(assessment.date),
      title: assessment.title,
      kind: ASSESSMENT_KIND_BY_SEED[assessment.kind],
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      date: assessmentDate,
      dueAt: assessmentDate,
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
}
