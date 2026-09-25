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
  options?: { onProgress?: () => void },
): Promise<void> {
  const inClassAssessments = dataset.entities.inClassAssessments ?? []
  const resultScores = dataset.extensions?.assessmentResultScores ?? {}
  const homeworkAssessments = dataset.entities.homeworkAssessments ?? []
  const homeworkSubmissions = dataset.entities.homeworkSubmissions ?? []

  for (const assessment of inClassAssessments) {
    await port.createAssessment(assessmentSeedRecord(assessment))
    options?.onProgress?.()

    const scores = resultScores[assessment.id] ?? {}
    const records = Object.entries(scores).flatMap(([studentId, score]) => score === undefined ? [] : [{ id: `ar-${assessment.id}-${studentId}`, assessmentId: assessment.id, studentId, score }])
    if (port.recordAssessmentResults) {
      await port.recordAssessmentResults(records)
      for (const _record of records) options?.onProgress?.()
    }
    else {
      for (const record of records) {
        await port.recordAssessmentResult(record)
        options?.onProgress?.()
      }
    }
  }

  for (const assessment of homeworkAssessments) {
    await port.createAssessment(assessmentSeedRecord(assessment))
    options?.onProgress?.()
  }

  for (const submission of homeworkSubmissions) {
    await port.recordAssessmentResult(assessmentResultSeedRecord(submission))
    options?.onProgress?.()
  }
  let unpublishedIndex = 0
  for (const assessment of [...inClassAssessments, ...homeworkAssessments]) {
    const published = dataset.extensions?.reportCardResults?.some(result => result.periodId === assessment.periodId && result.classGroupId === assessment.classGroupId && result.narrativeStatus === 'published')
    // Published source periods must be fully approved; open periods demonstrate all three states.
    const state = published ? 'approved' : (['draft', 'submitted', 'approved'] as const)[unpublishedIndex++ % 3]!
    await port.finalizeMarks(assessment.id, state)
    options?.onProgress?.()
  }
}

export function countDevAssessmentSeedOperations(dataset: FixtureDataset): number {
  const inClassAssessments = dataset.entities.inClassAssessments ?? []
  const resultScores = dataset.extensions?.assessmentResultScores ?? {}
  const homeworkAssessments = dataset.entities.homeworkAssessments ?? []
  const homeworkSubmissions = dataset.entities.homeworkSubmissions ?? []

  let total = 0
  for (const assessment of inClassAssessments) {
    total += 1
    const scores = resultScores[assessment.id] ?? {}
    total += Object.values(scores).filter(score => score !== undefined).length
  }
  total += homeworkAssessments.length
  total += homeworkSubmissions.length
  return total + inClassAssessments.length + homeworkAssessments.length
}
