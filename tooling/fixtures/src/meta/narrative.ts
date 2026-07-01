/** UI-only presentation metadata — not persisted by `@edaya/seeding`. */

export type SeedIncidentMockCategory = 'Tardiness' | 'Behavior' | 'Conflict'

export type SeedIncidentMockSeverity = 'low' | 'medium' | 'high'

export interface SeedIncidentPresentation {
  mockCategory: SeedIncidentMockCategory
  mockSeverity: SeedIncidentMockSeverity
}

export const INCIDENT_PRESENTATION_BY_ID = {
  i1: { mockCategory: 'Tardiness', mockSeverity: 'low' },
  i2: { mockCategory: 'Behavior', mockSeverity: 'medium' },
  i3: { mockCategory: 'Conflict', mockSeverity: 'medium' },
} as const satisfies Record<string, SeedIncidentPresentation>

export type SeedCalendarMockType = 'holiday' | 'vacation' | 'closure' | 'ceremony'

export const CALENDAR_EVENT_MOCK_TYPE_BY_ID = {
  'yc-t1-start': 'ceremony',
  'yc-t1-toussaint': 'vacation',
  'yc-t1-noel': 'vacation',
  'yc-t1-conseil': 'closure',
  'yc-t2-start': 'ceremony',
  'yc-t2-sport': 'ceremony',
  'yc-t2-winter': 'vacation',
  'yc1': 'holiday',
  'yc2': 'holiday',
  'yc3': 'vacation',
  'yc4': 'closure',
  'yc5': 'ceremony',
  'yc6': 'ceremony',
  'yc7': 'holiday',
  'yc8': 'closure',
  'yc9': 'vacation',
  'yc10': 'ceremony',
  'yc-up-0': 'ceremony',
  'yc-up-2': 'ceremony',
  'yc-up-5': 'closure',
} as const satisfies Record<string, SeedCalendarMockType>

export function incidentPresentationFor(id: string): SeedIncidentPresentation {
  const presentation = INCIDENT_PRESENTATION_BY_ID[id as keyof typeof INCIDENT_PRESENTATION_BY_ID]
  if (!presentation) {
    throw new Error(`Missing incident presentation metadata for ${id}`)
  }
  return presentation
}

export function calendarMockTypeFor(id: string): SeedCalendarMockType {
  const mockType = CALENDAR_EVENT_MOCK_TYPE_BY_ID[id as keyof typeof CALENDAR_EVENT_MOCK_TYPE_BY_ID]
  if (!mockType) {
    throw new Error(`Missing calendar presentation metadata for ${id}`)
  }
  return mockType
}
