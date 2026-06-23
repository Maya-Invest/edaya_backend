import type {
  AssessmentResultSeedRecord,
  AssessmentSeedRecord,
  AssessmentsSeedPort,
} from './port'
import { countSeedAssessmentResults, countSeedAssessments } from '@edaya/dev-fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevAssessments } from './workflow'

describe('assessments seed port workflow', () => {
  test('seeds assessments and their defined student scores', async () => {
    const assessments: AssessmentSeedRecord[] = []
    const results: AssessmentResultSeedRecord[] = []
    const port: AssessmentsSeedPort = {
      createAssessment: async (record) => {
        assessments.push(record)
      },
      recordAssessmentResult: async (record) => {
        results.push(record)
      },
    }

    await seedDevAssessments(port)

    expect(assessments).toHaveLength(countSeedAssessments())
    expect(results).toHaveLength(countSeedAssessmentResults())
    expect(assessments[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(assessments.every(record => record.date === record.dueAt)).toBe(true)
    expect(results.every(record => Number.isFinite(record.score))).toBe(true)
  })
})
