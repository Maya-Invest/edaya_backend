import {
  countSeedAssessmentResults,
  countSeedAssessments,
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
} from '@edaya/dev-fixtures'
import { createHandlerAuthProvisioner, runDevAccessSeed, runDevAuthLink, runDevSchoolSeed } from '@edaya/seeding'
import { afterEach, describe, expect, it } from 'bun:test'
import { resetApiRuntimesForTests } from '@/runtime'
import { apiPgliteEnv } from '../support/api-pglite-env'

import {
  collectSetCookieHeaders,
  createAppRequest,
  createCoreRouteTestApp,
} from '../support/api-route-harness'

function unwrapEntityList<T>(values: unknown): T[] {
  if (!Array.isArray(values)) {
    return []
  }
  return values.map((entry) => {
    if (entry && typeof entry === 'object' && 'data' in entry && Object.keys(entry).length === 1) {
      return (entry as { data: T }).data
    }
    return entry as T
  })
}

const expectedAssessmentResultCount = countSeedAssessmentResults()

describe('dev assessments seed', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('seeds assessments, results and lets teachers list assessment entities', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    const seedResult = await runDevSchoolSeed(application)
    expect(seedResult.status).toBe('seeded')
    if (seedResult.status === 'seeded') {
      expect(seedResult.assessments).toBe(countSeedAssessments())
      expect(seedResult.assessmentResults).toBe(expectedAssessmentResultCount)
    }

    await runDevAuthLink(application, createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL))
    await runDevAccessSeed(application)

    const signIn = await app.request(createAppRequest('/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL, password: DEV_AUTH_PASSWORD }),
    }))
    const cookies = collectSetCookieHeaders(signIn)
    const authHeaders = {
      'content-type': 'application/json',
      'cookie': cookies.join('; '),
    }

    const [assessmentsResponse, resultsResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/assessments/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/assessment-results/list', {
        method: 'POST',
        headers: authHeaders,
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
  }, 30_000)
})
