import { DayOfWeek, TeacherUnavailability, TeacherUnavailabilityRecurrence } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('TeacherUnavailability', () => {
  test('accepts weekly and one-off constraints', () => {
    const weekly = new TeacherUnavailability({
      id: 'weekly',
      teacherId: 'teacher',
      academicYearId: 'year',
      recurrence: TeacherUnavailabilityRecurrence.Weekly,
      dayOfWeek: DayOfWeek.Monday,
      startTime: '08:30',
      endTime: '10:15',
      effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      effectiveUntil: new Date('2026-12-31T00:00:00.000Z'),
    })
    const oneOff = new TeacherUnavailability({
      id: 'one-off',
      teacherId: 'teacher',
      academicYearId: 'year',
      recurrence: TeacherUnavailabilityRecurrence.OneOff,
      startsAt: new Date('2026-10-08T13:00:00.000Z'),
      endsAt: new Date('2026-10-08T15:00:00.000Z'),
    })

    expect(weekly.dayOfWeek).toBe(DayOfWeek.Monday)
    expect(oneOff.startsAt?.toISOString()).toBe('2026-10-08T13:00:00.000Z')
  })

  test('rejects incomplete and reversed constraints', () => {
    expect(() => new TeacherUnavailability({
      id: 'invalid-weekly',
      teacherId: 'teacher',
      academicYearId: 'year',
      recurrence: TeacherUnavailabilityRecurrence.Weekly,
      dayOfWeek: DayOfWeek.Monday,
      startTime: '10:00',
      endTime: '09:00',
      effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      effectiveUntil: new Date('2026-12-31T00:00:00.000Z'),
    })).toThrow()
    expect(() => new TeacherUnavailability({
      id: 'invalid-one-off',
      teacherId: 'teacher',
      academicYearId: 'year',
      recurrence: TeacherUnavailabilityRecurrence.OneOff,
    })).toThrow()
  })
})
