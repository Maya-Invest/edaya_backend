import { MINIMAL_AUTH_FIXTURE_STAFF_EMAIL } from '@edaya/fixtures/meta/dev-auth-fixtures'
import { ApiError } from '@maya-invest/edaya-api-client'
import { expect, it } from 'bun:test'
import { createInProcessSchoolClient } from '../support/in-process-school-client'
import { describeWithMinimalSchool } from '../support/minimal-route-test-context'

describeWithMinimalSchool('upsert student health profile command', (getContext) => {
  it('creates and updates a health profile without client timestamps', async () => {
    const { app, authHeaders } = getContext()
    const authorization = (await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)).authorization
    const client = createInProcessSchoolClient(app, { headers: { authorization } })

    const created = await client.commands.upsertStudentHealthProfile({
      id: 'route-shp-s2',
      studentId: 'ci-s2',
      bloodType: 'A+',
      allergies: 'Pollen',
      medicalConditions: 'Asthme',
      medications: null,
      clinicalNotes: 'Seasonal allergy.',
      lastVisit: '2026-02-14T12:00:00.000Z',
      emergencyProtocols: null,
    })

    expect(created).toMatchObject({
      id: 'route-shp-s2',
      studentId: 'ci-s2',
      bloodType: 'A+',
      allergies: 'Pollen',
      medicalConditions: 'Asthme',
    })

    const updated = await client.commands.upsertStudentHealthProfile({
      id: 'route-shp-s2',
      studentId: 'ci-s2',
      bloodType: 'O+',
      allergies: 'Pollen, peanuts',
      medicalConditions: 'Asthme',
      medications: 'Ventoline',
      clinicalNotes: 'Carry inhaler.',
      lastVisit: '2026-03-01T12:00:00.000Z',
      emergencyProtocols: null,
    })

    expect(updated).toMatchObject({
      id: 'route-shp-s2',
      bloodType: 'O+',
      allergies: 'Pollen, peanuts',
      medications: 'Ventoline',
    })

    await expect(client.entities.studentHealthProfiles.get('route-shp-s2'))
      .resolves
      .toMatchObject({
        bloodType: 'O+',
        medications: 'Ventoline',
      })
  })

  it('rejects updatedAt without createdAt (timestamp skew)', async () => {
    const { app, authHeaders } = getContext()
    const authorization = (await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)).authorization
    const client = createInProcessSchoolClient(app, { headers: { authorization } })

    let caught: unknown
    try {
      await client.commands.upsertStudentHealthProfile({
        id: 'route-shp-skew',
        studentId: 'ci-s4',
        bloodType: 'B+',
        allergies: null,
        medicalConditions: null,
        medications: null,
        clinicalNotes: null,
        lastVisit: null,
        emergencyProtocols: null,
        // Client-only updatedAt; server defaults createdAt to now → validation fails.
        updatedAt: '2020-01-01T00:00:00.000Z',
      })
    }
    catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ApiError)
    const apiError = caught as ApiError
    expect(apiError.status).toBeGreaterThanOrEqual(400)
    const body = typeof apiError.body === 'string' ? apiError.body : JSON.stringify(apiError.body)
    expect(body).toMatch(/updatedAt must not be before createdAt/i)
  })
}, ['ci-s2', 'ci-s4'])
