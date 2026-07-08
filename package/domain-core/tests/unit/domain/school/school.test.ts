import { School, SchoolType } from '@edaya/core'
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
})
