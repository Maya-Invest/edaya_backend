import { DayOfWeek, TeacherUnavailability, TeacherUnavailabilityRecurrence } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { expandTeacherUnavailability, teacherUnavailabilityOverlaps } from '../../../src/services/workflows/teacher-unavailability'

describe('teacher unavailability expansion', () => {
  const weekly = new TeacherUnavailability({
    id: 'contract-hours',
    teacherId: 'teacher-1',
    academicYearId: 'year-1',
    recurrence: TeacherUnavailabilityRecurrence.Weekly,
    dayOfWeek: DayOfWeek.Monday,
    startTime: '08:30',
    endTime: '10:15',
    effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    effectiveUntil: new Date('2026-09-30T00:00:00.000Z'),
  })

  test('expands recurring rules and blocks partial period overlaps', () => {
    const expanded = expandTeacherUnavailability(
      weekly,
      new Date('2026-09-07T00:00:00.000Z'),
      new Date('2026-09-15T00:00:00.000Z'),
    )

    expect(expanded.map(interval => interval.startsAt.toISOString())).toEqual([
      '2026-09-07T08:30:00.000Z',
      '2026-09-14T08:30:00.000Z',
    ])
    expect(teacherUnavailabilityOverlaps(
      weekly,
      new Date('2026-09-07T08:00:00.000Z'),
      new Date('2026-09-07T09:00:00.000Z'),
    )).toBe(true)
    expect(teacherUnavailabilityOverlaps(
      weekly,
      new Date('2026-09-07T10:15:00.000Z'),
      new Date('2026-09-07T11:00:00.000Z'),
    )).toBe(false)
  })
})
