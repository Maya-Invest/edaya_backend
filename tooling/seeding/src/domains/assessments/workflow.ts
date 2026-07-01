import type { AssessmentInput, AssessmentResultInput } from '@edaya/core'
import type { FixtureDataset } from '@edaya/fixtures'
import type { AssessmentsSeedPort } from './port'

function isoDateTime(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return undefined
}

function assessmentSeedRecord(assessment: AssessmentInput) {
  return {
    id: assessment.id,
    classGroupId: assessment.classGroupId,
    classSubjectId: assessment.classSubjectId,
    periodId: assessment.periodId,
    title: assessment.title,
    kind: assessment.kind,
    maxScore: assessment.maxScore,
    coefficient: assessment.coefficient ?? 1,
    description: assessment.description ?? undefined,
    attachments: assessment.attachments?.map(attachment => ({ ...attachment })),
    startsAt: isoDateTime(assessment.startsAt),
    endsAt: isoDateTime(assessment.endsAt),
    dueAt: isoDateTime(assessment.dueAt),
    completedAt: isoDateTime(assessment.completedAt),
  }
}

function assessmentResultSeedRecord(result: AssessmentResultInput) {
  return {
    id: result.id,
    assessmentId: result.assessmentId,
    studentId: result.studentId,
    score: result.score ?? undefined,
    status: result.status ?? undefined,
  }
}

export async function seedDevAssessments(
  port: AssessmentsSeedPort,
  dataset: FixtureDataset,
): Promise<void> {
  const inClassAssessments = dataset.entities.inClassAssessments ?? []
  const resultScores = dataset.extensions?.assessmentResultScores ?? {}
  const homeworkAssessments = dataset.entities.homeworkAssessments ?? []
  const homeworkSubmissions = dataset.entities.homeworkSubmissions ?? []

  for (const assessment of inClassAssessments) {
    await port.createAssessment(assessmentSeedRecord(assessment))

    const scores = resultScores[assessment.id] ?? {}
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

  for (const assessment of homeworkAssessments) {
    await port.createAssessment(assessmentSeedRecord(assessment))
  }

  for (const submission of homeworkSubmissions) {
    await port.recordAssessmentResult(assessmentResultSeedRecord(submission))
  }
}
