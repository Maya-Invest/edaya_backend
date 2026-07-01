import type {
  CalendarEventSeedRecord,
  IncidentSeedRecord,
  SchoolLifeSeedPort,
  StudentIncidentInvolvementSeedRecord,
} from './port'
import { CalendarEventScopeKind, IncidentInvolvementRole, IncidentKind } from '@edaya/core'
import { demoDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevSchoolLife } from './workflow'

describe('school-life seed port workflow', () => {
  test('expands calendar scopes and records each incident before its involvement', async () => {
    const calendarEvents: CalendarEventSeedRecord[] = []
    const incidents: IncidentSeedRecord[] = []
    const involvements: StudentIncidentInvolvementSeedRecord[] = []
    const operationOrder: string[] = []
    const port: SchoolLifeSeedPort = {
      createCalendarEvent: async (record) => {
        calendarEvents.push(record)
      },
      recordIncident: async (record) => {
        incidents.push(record)
        operationOrder.push(`incident:${record.id}`)
      },
      addStudentInvolvement: async (record) => {
        involvements.push(record)
        operationOrder.push(`involvement:${record.incidentId}`)
      },
    }

    const counts = await seedDevSchoolLife(port, demoDataset)

    expect(counts).toEqual({
      calendarEvents: calendarEvents.length,
      incidents: demoDataset.entities.incidents?.length ?? 0,
    })
    expect(calendarEvents.length).toBeGreaterThan(0)
    expect(calendarEvents.some(event =>
      event.scopeKind === CalendarEventScopeKind.ClassGroup && event.scopeId === '6a')).toBe(true)
    expect(calendarEvents[0]?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(incidents.map(incident => incident.kind)).toContain(IncidentKind.MajorInfraction)
    expect(involvements.every(record => record.role === IncidentInvolvementRole.Subject)).toBe(true)
    expect(operationOrder.slice(0, 2)).toEqual(['incident:i1', 'involvement:i1'])
  })
})
