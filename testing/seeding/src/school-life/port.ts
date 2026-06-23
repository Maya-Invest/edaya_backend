import type {
  CalendarEventKind,
  CalendarEventScopeKind,
  IncidentInvolvementRole,
  IncidentKind,
} from '@edaya/core'

export interface CalendarEventSeedRecord {
  id: string
  schoolId: string
  academicYearId: string
  title: string
  description?: string
  startDate: string
  endDate: string
  kind: CalendarEventKind
  isNonSchoolDay: boolean
  scopeKind: CalendarEventScopeKind
  scopeId?: string
}

export interface IncidentSeedRecord {
  id: string
  schoolId: string
  classGroupId?: string
  title: string
  description: string
  date: string
  kind: IncidentKind
  reporterId: string
}

export interface StudentIncidentInvolvementSeedRecord {
  id: string
  incidentId: string
  studentId: string
  role: IncidentInvolvementRole
}

export interface SchoolLifeSeedPort {
  createCalendarEvent: (record: CalendarEventSeedRecord) => Promise<void>
  recordIncident: (record: IncidentSeedRecord) => Promise<void>
  addStudentInvolvement: (record: StudentIncidentInvolvementSeedRecord) => Promise<void>
}
