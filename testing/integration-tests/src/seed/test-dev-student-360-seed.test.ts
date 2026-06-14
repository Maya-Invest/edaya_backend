import {
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_PEDAGOGICAL_NOTES,
  SEED_STUDENT_HEALTH_PROFILES,
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

describe('dev student 360 seed', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('seeds health profiles and student notes and lets staff list student 360 entities', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    const seedResult = await runDevSchoolSeed(application)
    expect(seedResult.status).toBe('seeded')
    if (seedResult.status === 'seeded') {
      expect(seedResult.studentHealthProfiles).toBe(SEED_STUDENT_HEALTH_PROFILES.length)
      expect(seedResult.studentNotes).toBe(SEED_PEDAGOGICAL_NOTES.length)
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

    const [healthResponse, notesResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/student-health-profiles/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/student-notes/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
    ])

    expect(healthResponse.status).toBe(200)
    expect(notesResponse.status).toBe(200)

    const healthProfiles = unwrapEntityList<{
      id: string
      studentId: string
      medications?: string
      clinicalNotes?: string
      lastVisit?: string
    }>(await healthResponse.json())
    const notes = unwrapEntityList<{ id: string, studentId: string, category?: string }>(await notesResponse.json())

    expect(healthProfiles.length).toBeGreaterThanOrEqual(SEED_STUDENT_HEALTH_PROFILES.length)
    expect(notes.length).toBeGreaterThanOrEqual(SEED_PEDAGOGICAL_NOTES.length)
    expect(healthProfiles.some(profile => profile.id === 'hp-s1' && profile.studentId === 's1')).toBe(true)
    expect(healthProfiles.find(profile => profile.id === 'hp-s3')?.medications).toBe('EpiPen')
    expect(healthProfiles.find(profile => profile.id === 'hp-s3')?.clinicalNotes).toBe(
      'Severe peanut allergy. EpiPen in nurse\'s office.',
    )
    expect(healthProfiles.find(profile => profile.id === 'hp-s3')?.lastVisit).toBeDefined()
    expect(notes.some(note => note.id === 'pn1' && note.studentId === 's1')).toBe(true)
    expect(notes.find(note => note.id === 'pn1')?.category).toBe('progress')
    expect(notes.find(note => note.id === 'pn4')?.category).toBe('behavior')
  }, 30_000)
})
