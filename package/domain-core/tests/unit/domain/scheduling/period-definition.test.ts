import { DayOfWeek, PeriodDefinition } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('PeriodDefinition entity', () => {
  const baseArgs = {
    id: 'per1',
    schoolId: 'sch1',
    academicYearId: 'yr1',
    label: 'Period 1',
    dayOfWeek: DayOfWeek.Monday,
    order: 1,
    startTime: '08:00',
    endTime: '08:45',
  }

  test('instantiates successfully with valid inputs', () => {
    const period = new PeriodDefinition(baseArgs)
    expect(period.id).toBe('per1')
    expect(period.startTime).toBe('08:00')
    expect(period.endTime).toBe('08:45')
    expect(period.dayOfWeek).toBe(DayOfWeek.Monday)
    expect(period.isBreak).toBe(false)
    expect(period.isTeachingSlot).toBe(true)
    expect(period.durationMinutes).toBe(45)
  })

  test('calculates durationMinutes correctly', () => {
    const period = new PeriodDefinition({
      ...baseArgs,
      startTime: '09:15',
      endTime: '10:30',
    })
    expect(period.durationMinutes).toBe(75)
  })

  test('throws error if endTime is before startTime', () => {
    expect(() => {
      new PeriodDefinition({
        ...baseArgs,
        startTime: '08:45',
        endTime: '08:00',
      })
    }).toThrow('endTime must be after startTime')
  })

  test('throws error if endTime equals startTime', () => {
    expect(() => {
      new PeriodDefinition({
        ...baseArgs,
        startTime: '08:00',
        endTime: '08:00',
      })
    }).toThrow('endTime must be after startTime')
  })

  test('handles break periods correctly', () => {
    const period = new PeriodDefinition({
      ...baseArgs,
      isBreak: true,
      label: 'Recess',
      startTime: '10:30',
      endTime: '10:45',
    })
    expect(period.isBreak).toBe(true)
    expect(period.durationMinutes).toBe(15)
  })

  test('supports disabled teaching slots independently from breaks', () => {
    const period = new PeriodDefinition({
      ...baseArgs,
      dayOfWeek: DayOfWeek.Wednesday,
      isTeachingSlot: false,
    })

    expect(period.dayOfWeek).toBe(DayOfWeek.Wednesday)
    expect(period.isTeachingSlot).toBe(false)
    expect(period.isBreak).toBe(false)
  })
})
