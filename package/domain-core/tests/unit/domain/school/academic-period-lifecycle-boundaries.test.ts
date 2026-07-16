import { AcademicPeriod, AcademicPeriodType } from '@edaya/core'
import { describe, expect, it } from 'bun:test'

describe('AcademicPeriod entity lifecycle and boundaries', () => {
  const startDate = new Date('2026-09-01T00:00:00Z')
  const endDate = new Date('2026-12-31T23:59:59Z')

  const baseArgs = {
    id: 'term-1',
    schoolId: 'school-1',
    academicYearId: 'year-1',
    name: 'Trimester 1',
    type: AcademicPeriodType.Trimester,
    startDate,
    endDate,
  }

  it('instantiates successfully with valid inputs', () => {
    const period = new AcademicPeriod(baseArgs)

    expect(period.id).toBe('term-1')
    expect(period.schoolId).toBe('school-1')
    expect(period.academicYearId).toBe('year-1')
    expect(period.name).toBe('Trimester 1')
    expect(period.type).toBe(AcademicPeriodType.Trimester)
    expect(period.startDate.getTime()).toBe(startDate.getTime())
    expect(period.endDate.getTime()).toBe(endDate.getTime())
    expect(period.isPublished).toBe(false)
    expect(period.createdAt).toBeInstanceOf(Date)
  })

  it('handles optional parameters correctly', () => {
    const createdDate = new Date()
    const period = new AcademicPeriod({
      ...baseArgs,
      isPublished: true,
      createdAt: createdDate,
    })

    expect(period.isPublished).toBe(true)
    expect(period.createdAt.getTime()).toBe(createdDate.getTime())
  })

  it('throws error when endDate is before startDate', () => {
    expect(() => new AcademicPeriod({
      ...baseArgs,
      startDate: new Date('2026-12-01T00:00:00Z'),
      endDate: new Date('2026-09-01T00:00:00Z'),
    })).toThrow('endDate must not be before startDate')
  })

  it('verifies contains() evaluates boundaries correctly', () => {
    const period = new AcademicPeriod(baseArgs)

    expect(period.contains(startDate)).toBe(true)
    expect(period.contains(endDate)).toBe(true)
    expect(period.contains(new Date('2026-10-15T12:00:00Z'))).toBe(true)

    expect(period.contains(new Date('2026-08-31T23:59:59Z'))).toBe(false)
    expect(period.contains(new Date('2027-01-01T00:00:00Z'))).toBe(false)
  })

  it('throws error when required fields are empty', () => {
    expect(() => new AcademicPeriod({ ...baseArgs, id: '' })).toThrow()
    expect(() => new AcademicPeriod({ ...baseArgs, schoolId: ' ' })).toThrow()
    expect(() => new AcademicPeriod({ ...baseArgs, academicYearId: '\t' })).toThrow()
    expect(() => new AcademicPeriod({ ...baseArgs, name: ' \n ' })).toThrow()
  })
})
