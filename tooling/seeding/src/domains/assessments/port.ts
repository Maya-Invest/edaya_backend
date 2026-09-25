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
  designation?: 'scored' | 'absent' | 'exempt'
  score?: number
  status?: DeadlineComplianceStatus
}

export interface AssessmentsSeedPort {
  recordAssessmentResults?: (records: AssessmentResultSeedRecord[]) => Promise<void>
  finalizeMarks: (assessmentId: string, state: 'draft' | 'submitted' | 'correction-pending' | 'correction-approved' | 'correction-rejected') => Promise<void>
  createAssessment: (record: AssessmentSeedRecord) => Promise<void>
  recordAssessmentResult: (record: AssessmentResultSeedRecord) => Promise<void>
}
