import {
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_PEDAGOGICAL_NOTES,
  SEED_STUDENT_HEALTH_PROFILES,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, unwrapEntityList } from '../support/seeded-route-test-context'

describeWithSeededSchool('dev student 360 seed', (getContext) => {
  it('seeds health profiles and student notes and lets staff list student 360 entities', async () => {
    const { app, seedResult, authHeaders } = getContext()
    expect(seedResult.studentHealthProfiles).toBe(SEED_STUDENT_HEALTH_PROFILES.length)
    expect(seedResult.studentNotes).toBe(SEED_PEDAGOGICAL_NOTES.length)

    const headers = await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)
    const [healthResponse, notesResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/student-health-profiles/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/student-notes/list', {
        method: 'POST',
        headers,
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
  })
})
