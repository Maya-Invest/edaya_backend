import type { FixtureDataset } from '@edaya/fixtures'
import type { SchoolLifeSeedPort } from './port'
import { CalendarEventScopeKind } from '@edaya/core'
import { seedDateTime } from '../../support/seed-date'

export interface DevSchoolLifeSeedCounts {
  calendarEvents: number
  incidents: number
}

export async function seedDevSchoolLife(
  port: SchoolLifeSeedPort,
  dataset: FixtureDataset,
): Promise<DevSchoolLifeSeedCounts> {
  const academicYearId = dataset.entities.academicYear?.id
  if (!academicYearId) {
    throw new Error('Fixture dataset is missing academicYear')
  }

  const calendarEvents = dataset.extensions?.calendarEvents ?? []
  const incidents = dataset.entities.incidents ?? []
  const studentInvolvements = dataset.entities.studentIncidentInvolvements ?? []

  let calendarEventCount = 0

  for (const event of calendarEvents) {
    const baseRecord = {
      schoolId: dataset.schoolId,
      academicYearId,
      title: event.title,
      description: event.description,
      startDate: seedDateTime(event.startDate),
      endDate: seedDateTime(event.endDate),
      kind: event.kind,
      isNonSchoolDay: event.isNonSchoolDay,
    }

    if (event.scope === 'school') {
      await port.createCalendarEvent({
        ...baseRecord,
        id: event.id,
        scopeKind: CalendarEventScopeKind.School,
      })
      calendarEventCount += 1
      continue
    }

    for (const classGroupId of event.scope) {
      await port.createCalendarEvent({
        ...baseRecord,
        id: `${event.id}-${classGroupId}`,
        scopeKind: CalendarEventScopeKind.ClassGroup,
        scopeId: classGroupId,
      })
      calendarEventCount += 1
    }
  }

  const involvementsByIncidentId = new Map(
    studentInvolvements.map(involvement => [involvement.incidentId, involvement]),
  )

  for (const incident of incidents) {
    await port.recordIncident({
      id: incident.id,
      schoolId: incident.schoolId,
      classGroupId: incident.classGroupId ?? undefined,
      title: incident.title,
      description: incident.description,
      date: seedDateTime(String(incident.date).slice(0, 10)),
      kind: incident.kind,
      reporterId: incident.reporterId,
    })

    const involvement = involvementsByIncidentId.get(incident.id)
    if (!involvement) {
      throw new Error(`Missing student involvement for incident ${incident.id}`)
    }

    await port.addStudentInvolvement({
      id: involvement.id,
      incidentId: involvement.incidentId,
      studentId: involvement.studentId,
      role: involvement.role,
    })
  }

  return {
    calendarEvents: calendarEventCount,
    incidents: incidents.length,
  }
}
