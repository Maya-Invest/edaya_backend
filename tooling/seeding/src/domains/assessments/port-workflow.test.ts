import type {
  AssessmentResultSeedRecord,
  AssessmentSeedRecord,
  AssessmentsSeedPort,
} from './port'
import { AssessmentKind, DeadlineComplianceStatus } from '@edaya/core'
import { demoDataset } from '@edaya/fixtures'
import { resolveExpectedCounts } from '@edaya/fixtures/meta/fixture-counts'
import { describe, expect, test } from 'bun:test'
import { seedDevAssessments } from './workflow'

describe('assessments seed port workflow', () => {
  test('seeds in-class assessments, homework, and their results', async () => {
    const assessments: AssessmentSeedRecord[] = []
    const results: AssessmentResultSeedRecord[] = []
    const port: AssessmentsSeedPort = {
      finalizeMarks: async () => {},
      createAssessment: async (record) => {
        assessments.push(record)
      },
      recordAssessmentResult: async (record) => {
        results.push(record)
      },
    }

    await seedDevAssessments(port, demoDataset)

    const expected = resolveExpectedCounts(demoDataset)
    expect(assessments).toHaveLength(expected.assessments ?? 0)
    expect(results).toHaveLength(expected['assessment-results'] ?? 0)

    const inClass = assessments.find(record => record.id === 'e1')
    expect(inClass?.startsAt).toBeDefined()
    expect(inClass?.endsAt).toBeDefined()
    expect(inClass?.dueAt).toBeUndefined()

    const homework = assessments.find(record => record.kind === AssessmentKind.Homework)
    expect(homework?.dueAt).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(homework?.startsAt).toBeUndefined()

    expect(results.some(record => record.status === DeadlineComplianceStatus.Late)).toBe(true)
    expect(results.filter(record => record.score !== undefined).every(record => Number.isFinite(record.score!))).toBe(true)
  })
})
