import type { HomeworkAssignmentType, HomeworkSubmissionStatus } from '@edaya/core'

export interface HomeworkAttachmentSeedRecord {
  name: string
  size: string
}

export interface HomeworkAssignmentSeedRecord {
  id: string
  schoolId: string
  classGroupId: string
  classSubjectId: string
  title: string
  description: string
  dueDate: string
  assignedDate: string
  type: HomeworkAssignmentType
  attachments: readonly HomeworkAttachmentSeedRecord[]
}

export interface HomeworkSubmissionSeedRecord {
  id: string
  homeworkAssignmentId: string
  studentId: string
  status: HomeworkSubmissionStatus
  submittedAt?: string
}

export interface ClassLogbookEntrySeedRecord {
  id: string
  schoolId: string
  classGroupId: string
  classSubjectId: string
  date: string
  chapter: string
  content: string
  objectives: readonly string[]
  homework?: string
  attachments: readonly string[]
  progress: number
}

export interface LearningContentSeedPort {
  saveHomeworkAssignment: (record: HomeworkAssignmentSeedRecord) => Promise<void>
  saveHomeworkSubmission: (record: HomeworkSubmissionSeedRecord) => Promise<void>
  saveClassLogbookEntry: (record: ClassLogbookEntrySeedRecord) => Promise<void>
}
