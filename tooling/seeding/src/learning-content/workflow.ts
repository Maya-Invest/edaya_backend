import type { LearningContentSeedPort } from './port'
import { HomeworkAssignmentType, HomeworkSubmissionStatus } from '@edaya/core'
import {
  SEED_HOMEWORK_ASSIGNMENTS,
  SEED_HOMEWORK_SUBMISSIONS,
  SEED_TEACHING_LOG_ENTRIES,
} from '@edaya/dev-fixtures'
import { seedDateTime } from '../seed-date'

const HOMEWORK_TYPE_BY_SEED = {
  homework: HomeworkAssignmentType.Homework,
  project: HomeworkAssignmentType.Project,
  reading: HomeworkAssignmentType.Reading,
  lab: HomeworkAssignmentType.Lab,
} as const

const SUBMISSION_STATUS_BY_SEED = {
  submitted: HomeworkSubmissionStatus.Submitted,
  late: HomeworkSubmissionStatus.Late,
  missing: HomeworkSubmissionStatus.Missing,
} as const

export interface DevLearningContentSeedCounts {
  homeworkAssignments: number
  homeworkSubmissions: number
  classLogbookEntries: number
}

export async function seedDevLearningContent(
  port: LearningContentSeedPort,
): Promise<DevLearningContentSeedCounts> {
  for (const assignment of SEED_HOMEWORK_ASSIGNMENTS) {
    await port.saveHomeworkAssignment({
      id: assignment.id,
      schoolId: assignment.schoolId,
      classGroupId: assignment.classGroupId,
      classSubjectId: assignment.classSubjectId,
      title: assignment.title,
      description: assignment.description,
      dueDate: seedDateTime(assignment.dueDate),
      assignedDate: seedDateTime(assignment.assignedDate),
      type: HOMEWORK_TYPE_BY_SEED[assignment.type],
      attachments: assignment.attachments.map(attachment => ({ ...attachment })),
    })
  }

  for (const submission of SEED_HOMEWORK_SUBMISSIONS) {
    await port.saveHomeworkSubmission({
      id: submission.id,
      homeworkAssignmentId: submission.homeworkAssignmentId,
      studentId: submission.studentId,
      status: SUBMISSION_STATUS_BY_SEED[submission.status],
      submittedAt: submission.submittedAt ? seedDateTime(submission.submittedAt) : undefined,
    })
  }

  for (const entry of SEED_TEACHING_LOG_ENTRIES) {
    await port.saveClassLogbookEntry({
      id: entry.id,
      schoolId: entry.schoolId,
      classGroupId: entry.classGroupId,
      classSubjectId: entry.classSubjectId,
      date: seedDateTime(entry.date),
      chapter: entry.chapter,
      content: entry.content,
      objectives: [...entry.objectives],
      homework: entry.homework,
      attachments: entry.attachments ? [...entry.attachments] : [],
      progress: entry.progress,
    })
  }

  return {
    homeworkAssignments: SEED_HOMEWORK_ASSIGNMENTS.length,
    homeworkSubmissions: SEED_HOMEWORK_SUBMISSIONS.length,
    classLogbookEntries: SEED_TEACHING_LOG_ENTRIES.length,
  }
}
