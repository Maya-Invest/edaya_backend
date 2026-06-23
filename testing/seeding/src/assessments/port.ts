import type { AssessmentKind } from '@edaya/core'

export interface AssessmentSeedRecord {
  id: string
  classGroupId: string
  classSubjectId: string
  periodId: string
  title: string
  kind: AssessmentKind
  maxScore: number
  coefficient: number
  date: string
  dueAt: string
}

export interface AssessmentResultSeedRecord {
  id: string
  assessmentId: string
  studentId: string
  score: number
}

export interface AssessmentsSeedPort {
  createAssessment: (record: AssessmentSeedRecord) => Promise<void>
  recordAssessmentResult: (record: AssessmentResultSeedRecord) => Promise<void>
}
