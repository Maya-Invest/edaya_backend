import type {
  ClassLogbookEntrySeedRecord,
  HomeworkAssignmentSeedRecord,
  HomeworkSubmissionSeedRecord,
  LearningContentSeedPort,
} from './port'
import { HomeworkAssignmentType, HomeworkSubmissionStatus } from '@edaya/core'
import {
  SEED_HOMEWORK_ASSIGNMENTS,
  SEED_HOMEWORK_SUBMISSIONS,
  SEED_TEACHING_LOG_ENTRIES,
} from '@edaya/dev-fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevLearningContent } from './workflow'

describe('learning-content seed port workflow', () => {
  test('seeds homework, submissions, and logbook entries as plain records', async () => {
    const assignments: HomeworkAssignmentSeedRecord[] = []
    const submissions: HomeworkSubmissionSeedRecord[] = []
    const logbookEntries: ClassLogbookEntrySeedRecord[] = []
    const port: LearningContentSeedPort = {
      saveHomeworkAssignment: async (record) => {
        assignments.push(record)
      },
      saveHomeworkSubmission: async (record) => {
        submissions.push(record)
      },
      saveClassLogbookEntry: async (record) => {
        logbookEntries.push(record)
      },
    }

    const counts = await seedDevLearningContent(port)

    expect(counts).toEqual({
      homeworkAssignments: SEED_HOMEWORK_ASSIGNMENTS.length,
      homeworkSubmissions: SEED_HOMEWORK_SUBMISSIONS.length,
      classLogbookEntries: SEED_TEACHING_LOG_ENTRIES.length,
    })
    expect(assignments[0]?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(assignments.map(record => record.type)).toContain(HomeworkAssignmentType.Homework)
    expect(submissions.map(record => record.status)).toContain(HomeworkSubmissionStatus.Missing)
    expect(submissions.find(record => record.status === HomeworkSubmissionStatus.Missing)?.submittedAt)
      .toBeUndefined()
    expect(logbookEntries[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
  })
})
