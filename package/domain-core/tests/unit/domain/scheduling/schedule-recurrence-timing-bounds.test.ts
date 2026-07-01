import { describe, expect, it } from 'bun:test'
import { DayOfWeek, Schedule } from '../../../../src/domain/scheduling/schedule'

describe('Schedule entity recurrence and timing bounds', () => {
  const baseArgs = {
    id: 'schedule-1',
    classGroupId: 'class-1',
    title: 'Math Class',
    startTime: '08:00',
    endTime: '09:00',
  }

  it('instantiates successfully for a recurring schedule', () => {
    const schedule = new Schedule({
      ...baseArgs,
      isRecurring: true,
      dayOfWeek: DayOfWeek.Monday,
    })

    expect(schedule.id).toBe('schedule-1')
    expect(schedule.classGroupId).toBe('class-1')
    expect(schedule.title).toBe('Math Class')
    expect(schedule.isRecurring).toBe(true)
    expect(schedule.dayOfWeek).toBe(DayOfWeek.Monday)
    expect(schedule.startTime).toBe('08:00')
    expect(schedule.endTime).toBe('09:00')
    expect(schedule.specificDate).toBeUndefined()
    expect(schedule.createdAt).toBeInstanceOf(Date)
  })

  it('instantiates successfully for a non-recurring schedule', () => {
    const testDate = new Date('2026-09-01T00:00:00Z')
    const schedule = new Schedule({
      ...baseArgs,
      isRecurring: false,
      specificDate: testDate,
    })

    expect(schedule.isRecurring).toBe(false)
    expect(schedule.specificDate?.getTime()).toBe(testDate.getTime())
    expect(schedule.dayOfWeek).toBeUndefined()
  })

  it('throws error when endTime is before or equal to startTime', () => {
    expect(() => new Schedule({
      ...baseArgs,
      startTime: '09:00',
      endTime: '08:00',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Tuesday,
    })).toThrow('endTime must be after startTime')

    expect(() => new Schedule({
      ...baseArgs,
      startTime: '09:00',
      endTime: '09:00',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Wednesday,
    })).toThrow('endTime must be after startTime')
  })

  it('throws error when invalid time format is provided', () => {
    expect(() => new Schedule({
      ...baseArgs,
      startTime: 'invalid',
      endTime: '09:00',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Monday,
    })).toThrow()

    expect(() => new Schedule({
      ...baseArgs,
      startTime: '08:00',
      endTime: '25:00',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Monday,
    })).toThrow()
  })

  it('validates requirements for recurring schedule', () => {
    expect(() => new Schedule({
      ...baseArgs,
      isRecurring: true,
    })).toThrow('dayOfWeek is required for recurring schedules')
  })

  it('validates requirements for non-recurring schedule', () => {
    expect(() => new Schedule({
      ...baseArgs,
      isRecurring: false,
    })).toThrow('specificDate is required for non-recurring schedules')
  })
})
