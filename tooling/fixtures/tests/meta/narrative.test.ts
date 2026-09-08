import { describe, expect, it } from 'bun:test'
import { demoCalendarEvents } from '../../src/datasets/demo/domains/calendar'
import { CALENDAR_EVENT_MOCK_TYPE_BY_ID, INCIDENT_PRESENTATION_BY_ID } from '../../src/meta/narrative'

describe('meta presentation narrative', () => {
  it('maps every seeded incident id', () => {
    expect(Object.keys(INCIDENT_PRESENTATION_BY_ID)).toEqual(['i1', 'i2', 'i3'])
  })

  it('maps every calendar event id used by fixtures', () => {
    expect(Object.keys(CALENDAR_EVENT_MOCK_TYPE_BY_ID)).toHaveLength(20)
    expect(demoCalendarEvents.length).toBeGreaterThan(0)
  })
})
