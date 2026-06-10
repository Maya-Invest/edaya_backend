import { describe, expect, it } from 'bun:test'
import { AcademicYear } from '../../../../src/domains/school/academic-year'

describe('AcademicYear entity containment and chronology', () => {
  const startDate = new Date('2026-09-01T00:00:00Z')
  const endDate = new Date('2027-06-30T23:59:59Z')

  const baseArgs = {
    id: 'year-1',
    schoolId: 'school-1',
    name: '2026-2027',
    startDate,
    endDate,
  }

  it('instantiates successfully with chronological dates', () => {
    const year = new AcademicYear(baseArgs)

    expect(year.id).toBe('year-1')
    expect(year.schoolId).toBe('school-1')
    expect(year.name).toBe('2026-2027')
    expect(year.startDate.getTime()).toBe(startDate.getTime())
    expect(year.endDate.getTime()).toBe(endDate.getTime())
    expect(year.isActive).toBe(true)
    expect(year.createdAt).toBeInstanceOf(Date)
  })

  it('handles optional parameters correctly', () => {
    const createdDate = new Date()
    const year = new AcademicYear({
      ...baseArgs,
      isActive: false,
      createdAt: createdDate,
    })

    expect(year.isActive).toBe(false)
    expect(year.createdAt.getTime()).toBe(createdDate.getTime())
  })

  it('throws error when endDate is before startDate', () => {
    expect(() => new AcademicYear({
      ...baseArgs,
      startDate: new Date('2027-09-01T00:00:00Z'),
      endDate: new Date('2026-09-01T00:00:00Z'),
    })).toThrow('endDate must not be before startDate')
  })

  it('verifies contains() correctly evaluates dates inside and outside the year boundary', () => {
    const year = new AcademicYear(baseArgs)

    // Boundaries inclusive
    expect(year.contains(startDate)).toBe(true)
    expect(year.contains(endDate)).toBe(true)

    // Mid-year
    expect(year.contains(new Date('2026-12-25T12:00:00Z'))).toBe(true)

    // Outside year
    expect(year.contains(new Date('2026-08-31T23:59:59Z'))).toBe(false)
    expect(year.contains(new Date('2027-07-01T00:00:00Z'))).toBe(false)
  })

  it('throws error when non-blank fields are invalid', () => {
    expect(() => new AcademicYear({ ...baseArgs, id: '   ' })).toThrow()
    expect(() => new AcademicYear({ ...baseArgs, schoolId: '' })).toThrow()
    expect(() => new AcademicYear({ ...baseArgs, name: ' \t ' })).toThrow()
  })
})
