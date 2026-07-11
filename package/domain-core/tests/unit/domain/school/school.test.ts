import { School, SchoolType, TimetableGenerationMode } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('School entity', () => {
  const baseArgs = {
    id: 'sch1',
    name: 'Edaya High School',
    timeZone: 'Africa/Douala',
  }

  test('instantiates successfully with valid inputs', () => {
    const school = new School({
      ...baseArgs,
      ownerSubjectId: 'staff-owner',
      type: SchoolType.Secondary,
      country: 'Cameroon',
      city: 'Douala',
    })

    expect(school.id).toBe('sch1')
    expect(school.name).toBe('Edaya High School')
    expect(school.timeZone).toBe('Africa/Douala')
    expect(school.ownerSubjectId).toBe('staff-owner')
    expect(school.type).toBe(SchoolType.Secondary)
    expect(school.location).toBe('Douala, Cameroon')
    expect(school.timetableEnforceWorkloadFulfillment).toBe(true)
    expect(school.timetableExcludeBreakSlots).toBe(true)
    expect(school.timetableMinDayGapSameSubject).toBe(1)
    expect(school.timetablePreferredPeriodDefinitionIds).toEqual([])
    expect(school.timetableAllowUnassignedTeacherPlacements).toBe(false)
    expect(school.timetableUseHomeroomTeacherFallback).toBe(false)
    expect(school.timetableGenerationMode).toBe(TimetableGenerationMode.Weekly)
    expect(school.createdAt).toBeInstanceOf(Date)
  })

  test('location formatting omits undefined fields', () => {
    const school1 = new School({ ...baseArgs, city: 'Douala' })
    expect(school1.location).toBe('Douala')

    const school2 = new School({ ...baseArgs, country: 'Cameroon' })
    expect(school2.location).toBe('Cameroon')

    const school3 = new School(baseArgs)
    expect(school3.location).toBeUndefined()
  })

  test('throws error for invalid time zone', () => {
    expect(() => {
      new School({ ...baseArgs, timeZone: 'Invalid/Zone' })
    }).toThrow('Invalid IANA time zone: Invalid/Zone')
  })

  test('accepts timetable generation overrides', () => {
    const school = new School({
      ...baseArgs,
      timetableEnforceWorkloadFulfillment: false,
      timetableExcludeBreakSlots: false,
      timetableMinDayGapSameSubject: 0,
      timetablePreferredPeriodDefinitionIds: ['period-1'],
      timetableAllowUnassignedTeacherPlacements: true,
      timetableUseHomeroomTeacherFallback: true,
    })

    expect(school.timetableEnforceWorkloadFulfillment).toBe(false)
    expect(school.timetableExcludeBreakSlots).toBe(false)
    expect(school.timetableMinDayGapSameSubject).toBe(0)
    expect(school.timetablePreferredPeriodDefinitionIds).toEqual(['period-1'])
    expect(school.timetableAllowUnassignedTeacherPlacements).toBe(true)
    expect(school.timetableUseHomeroomTeacherFallback).toBe(true)
  })
})
