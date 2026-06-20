import {
  countSeedAssessmentResults,
  countSeedAssessments,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, unwrapEntityList } from '../support/seeded-route-test-context'

const expectedAssessmentResultCount = countSeedAssessmentResults()

describeWithSeededSchool('dev assessments seed', (getContext) => {
  it('seeds assessments, results and lets teachers list assessment entities', async () => {
    const { app, seedResult, authHeaders } = getContext()
    expect(seedResult.assessments).toBe(countSeedAssessments())
    expect(seedResult.assessmentResults).toBe(expectedAssessmentResultCount)

    const headers = await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)
    const [assessmentsResponse, resultsResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/assessments/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/assessment-results/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
    ])

    expect(assessmentsResponse.status).toBe(200)
    expect(resultsResponse.status).toBe(200)

    const assessments = unwrapEntityList<{ id: string, title: string, classGroupId: string }>(await assessmentsResponse.json())
    const results = unwrapEntityList<{ assessmentId: string, studentId: string, score?: number }>(await resultsResponse.json())

    expect(assessments.length).toBeGreaterThanOrEqual(countSeedAssessments())
    expect(results.length).toBeGreaterThanOrEqual(expectedAssessmentResultCount)
    expect(assessments.some(assessment => assessment.id === 'e1' && assessment.classGroupId === '6a')).toBe(true)
    expect(assessments.some(assessment => assessment.id === 'e5' && assessment.classGroupId === 'term-s')).toBe(true)
    expect(results.some(result => result.assessmentId === 'e1' && result.studentId === 's1')).toBe(true)
    expect(results.some(result => result.assessmentId === 'e5' && result.studentId === 's9')).toBe(true)
  })
})
