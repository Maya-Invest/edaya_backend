import type { SchoolLifeSeedPort } from './port'
import {
  CalendarEventKind,
  CalendarEventScopeKind,
  IncidentInvolvementRole,
  IncidentKind,
} from '@edaya/core'
import {
  SEED_ACADEMIC_YEAR_ID,
  SEED_ALL_CALENDAR_EVENTS,
  SEED_INCIDENTS,
  SEED_SCHOOL_ID,
} from '@edaya/dev-fixtures'
import { seedDateTime } from '../seed-date'

const CALENDAR_KIND_BY_SEED = {
  holiday: CalendarEventKind.Holiday,
  vacation: CalendarEventKind.Break,
  closure: CalendarEventKind.Other,
  ceremony: CalendarEventKind.Event,
} as const

export interface DevSchoolLifeSeedCounts {
  calendarEvents: number
  incidents: number
}

export async function seedDevSchoolLife(
  port: SchoolLifeSeedPort,
): Promise<DevSchoolLifeSeedCounts> {
  let calendarEventCount = 0

  for (const event of SEED_ALL_CALENDAR_EVENTS) {
    const baseRecord = {
      schoolId: SEED_SCHOOL_ID,
      academicYearId: SEED_ACADEMIC_YEAR_ID,
      title: event.title,
      description: event.description,
      startDate: seedDateTime(event.startDate),
      endDate: seedDateTime(event.endDate),
      kind: CALENDAR_KIND_BY_SEED[event.mockType],
      isNonSchoolDay: event.mockType !== 'ceremony',
    }

    if (event.scope === 'all') {
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

  for (const incident of SEED_INCIDENTS) {
    await port.recordIncident({
      id: incident.id,
      schoolId: SEED_SCHOOL_ID,
      classGroupId: incident.classGroupId,
      title: incident.title,
      description: incident.description,
      date: seedDateTime(incident.date),
      kind: incident.kind === 'major_infraction'
        ? IncidentKind.MajorInfraction
        : IncidentKind.MinorInfraction,
      reporterId: 'st7',
    })
    await port.addStudentInvolvement({
      id: `inv-${incident.id}-${incident.studentId}`,
      incidentId: incident.id,
      studentId: incident.studentId,
      role: IncidentInvolvementRole.Subject,
    })
  }

  return {
    calendarEvents: calendarEventCount,
    incidents: SEED_INCIDENTS.length,
  }
}
