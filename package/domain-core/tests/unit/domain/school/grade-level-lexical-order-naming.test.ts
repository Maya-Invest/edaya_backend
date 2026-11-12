import { GradeLevel } from '@edaya/core'
import { describe, expect, it } from 'bun:test'

describe('GradeLevel entity lexical order and naming', () => {
  const baseArgs = {
    id: 'grade-6',
    schoolId: 'school-1',
    name: 'Grade 6',
    shortName: 'G6',
    order: 6,
  }

  it('instantiates successfully with valid inputs', () => {
    const gradeLevel = new GradeLevel(baseArgs)

    expect(gradeLevel.id).toBe('grade-6')
    expect(gradeLevel.schoolId).toBe('school-1')
    expect(gradeLevel.name).toBe('Grade 6')
    expect(gradeLevel.shortName).toBe('G6')
    expect(gradeLevel.order).toBe(6)
    expect(gradeLevel.createdAt).toBeInstanceOf(Date)
  })

  it('handles optional parameters correctly', () => {
    const createdDate = new Date()
    const gradeLevel = new GradeLevel({
      ...baseArgs,
      cycle: 'Middle School',
      createdAt: createdDate,
    })

    expect(gradeLevel.cycle).toBe('Middle School')
    expect(gradeLevel.createdAt.getTime()).toBe(createdDate.getTime())
  })

  it('throws error when non-blank fields are empty or invalid', () => {
    expect(() => new GradeLevel({ ...baseArgs, id: ' ' })).toThrow()
    expect(() => new GradeLevel({ ...baseArgs, schoolId: '' })).toThrow()
    expect(() => new GradeLevel({ ...baseArgs, name: ' \t ' })).toThrow()
    expect(() => new GradeLevel({ ...baseArgs, shortName: '  ' })).toThrow()
  })

  it('throws error when order is zero or negative', () => {
    expect(() => new GradeLevel({ ...baseArgs, order: 0 })).toThrow()
    expect(() => new GradeLevel({ ...baseArgs, order: -1 })).toThrow()
  })

  it('throws error when optional cycle is empty string', () => {
    expect(() => new GradeLevel({ ...baseArgs, cycle: ' \n' })).toThrow()
  })
})
