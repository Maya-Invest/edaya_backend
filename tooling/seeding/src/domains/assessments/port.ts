import type { AssessmentKind, DeadlineComplianceStatus } from '@edaya/core'

export interface AssessmentAttachmentSeedRecord {
  name: string
  size: string
}

export interface AssessmentSeedRecord {
  id: string
  classGroupId: string
  classSubjectId: string
  periodId: string
  title: string
  kind: AssessmentKind
  maxScore: number
  coefficient: number
  description?: string
  attachments?: AssessmentAttachmentSeedRecord[]
  startsAt?: string
  endsAt?: string
  dueAt?: string
  completedAt?: string
}

export interface AssessmentResultSeedRecord {
  id: string
  assessmentId: string
  studentId: string
  score?: number
  status?: DeadlineComplianceStatus
}

export interface AssessmentsSeedPort {
  createAssessment: (record: AssessmentSeedRecord) => Promise<void>
  recordAssessmentResult: (record: AssessmentResultSeedRecord) => Promise<void>
}
