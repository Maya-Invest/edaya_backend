import {
  countSeedAttendanceRecords,
  countSeedCalendarEvents,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_INCIDENTS,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, unwrapEntityList } from '../support/seeded-route-test-context'

const expectedCalendarEvents = countSeedCalendarEvents()

describeWithSeededSchool('dev school life seed', (getContext) => {
  it('seeds calendar, incidents, attendance and lets staff list school-life entities', async () => {
    const { app, seedResult, authHeaders } = getContext()
    expect(seedResult.calendarEvents).toBe(expectedCalendarEvents)
    expect(seedResult.incidents).toBe(SEED_INCIDENTS.length)
    expect(seedResult.attendanceRecords).toBe(countSeedAttendanceRecords())

    const headers = await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)
    const [calendarResponse, incidentsResponse, attendanceResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/calendar-events/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/incidents/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/attendance/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
    ])

    expect(calendarResponse.status).toBe(200)
    expect(incidentsResponse.status).toBe(200)
    expect(attendanceResponse.status).toBe(200)

    const calendarEvents = unwrapEntityList<{ id: string, title: string, description?: string }>(await calendarResponse.json())
    const incidents = unwrapEntityList<{ id: string, title: string, kind: string }>(await incidentsResponse.json())
    const attendance = unwrapEntityList<{ id: string, studentId: string }>(await attendanceResponse.json())

    expect(calendarEvents.length).toBeGreaterThanOrEqual(expectedCalendarEvents)
    expect(incidents.length).toBeGreaterThanOrEqual(SEED_INCIDENTS.length)
    expect(attendance.length).toBeGreaterThanOrEqual(countSeedAttendanceRecords())
    expect(calendarEvents.some(event => event.title === 'Fête du Travail')).toBe(true)
    expect(calendarEvents.find(event => event.id === 'yc3')?.description).toBe(
      'Vacances scolaires de printemps. Réouverture le 4 mai.',
    )
    expect(incidents.some(incident => incident.id === 'i1')).toBe(true)
    expect(incidents.find(incident => incident.id === 'i1')?.kind).toBe('minor_infraction')
    expect(incidents.find(incident => incident.id === 'i2')?.kind).toBe('minor_infraction')
    expect(incidents.find(incident => incident.id === 'i3')?.kind).toBe('major_infraction')
    expect(attendance.some(record => record.id === 'a1' && record.studentId === 's1')).toBe(true)
  })
})
