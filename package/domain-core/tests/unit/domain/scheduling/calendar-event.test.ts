import { describe, expect, test } from 'bun:test'
import { CalendarEvent, CalendarEventKind, CalendarEventScopeKind } from '../../../../src/domains/scheduling/calendar-event'

describe('CalendarEvent entity', () => {
  const baseArgs = {
    id: 'evt1',
    schoolId: 'sch1',
    academicYearId: 'y1',
    title: 'Spring Break',
    startDate: new Date('2026-03-01T00:00:00Z'),
    endDate: new Date('2026-03-07T00:00:00Z'),
    kind: CalendarEventKind.Break,
  }

  test('instantiates successfully with valid inputs', () => {
    const event = new CalendarEvent({
      ...baseArgs,
      description: 'Two-week spring break for all students.',
    })
    expect(event.id).toBe('evt1')
    expect(event.description).toBe('Two-week spring break for all students.')
    expect(event.isNonSchoolDay).toBe(false)
    expect(event.scopeKind).toBe(CalendarEventScopeKind.School)
    expect(event.durationDays).toBe(7)
  })

  test('calculates durationDays correctly for same day', () => {
    const event = new CalendarEvent({
      ...baseArgs,
      startDate: new Date('2026-03-01T00:00:00Z'),
      endDate: new Date('2026-03-01T00:00:00Z'),
    })
    expect(event.durationDays).toBe(1)
  })

  test('throws error if endDate is before startDate', () => {
    expect(() => {
      new CalendarEvent({
        ...baseArgs,
        startDate: new Date('2026-03-02T00:00:00Z'),
        endDate: new Date('2026-03-01T00:00:00Z'),
      })
    }).toThrow('endDate must not be before startDate')
  })

  test('throws error if scoped event lacks scopeId', () => {
    expect(() => {
      new CalendarEvent({
        ...baseArgs,
        scopeKind: CalendarEventScopeKind.GradeLevel,
      })
    }).toThrow('scopeId is required for scoped calendar events')
  })

  test('throws error if school-wide event defines scopeId', () => {
    expect(() => {
      new CalendarEvent({
        ...baseArgs,
        scopeKind: CalendarEventScopeKind.School,
        scopeId: 'gl1',
      })
    }).toThrow('school-wide calendar events must not define scopeId')
  })

  test('instantiates successfully with valid scopeId', () => {
    const event = new CalendarEvent({
      ...baseArgs,
      scopeKind: CalendarEventScopeKind.GradeLevel,
      scopeId: 'gl1',
    })
    expect(event.scopeId).toBe('gl1')
  })
})
