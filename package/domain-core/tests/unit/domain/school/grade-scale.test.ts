import { describe, expect, test } from 'bun:test'
import { GradeScale } from '../../../../src/domain/school/grade-scale'

describe('GradeScale entity', () => {
  const baseArgs = {
    id: 'gs1',
    schoolId: 'sch1',
    name: 'Standard 20',
    minScore: 0,
    maxScore: 20,
    ranges: [
      { letter: 'F', minScore: 0, maxScore: 9.99, isPassing: false },
      { letter: 'C', minScore: 10, maxScore: 13.99, isPassing: true, gpaValue: 2.0 },
      { letter: 'B', minScore: 14, maxScore: 15.99, isPassing: true, gpaValue: 3.0 },
      { letter: 'A', minScore: 16, maxScore: 20, isPassing: true, gpaValue: 4.0 },
    ],
  }

  test('instantiates successfully with valid inputs', () => {
    const scale = new GradeScale(baseArgs)
    expect(scale.id).toBe('gs1')
    expect(scale.ranges.length).toBe(4)
    expect(scale.isDefault).toBe(false)
  })

  test('findRange returns correct range', () => {
    const scale = new GradeScale(baseArgs)
    expect(scale.findRange(10)?.letter).toBe('C')
    expect(scale.findRange(15)?.letter).toBe('B')
    expect(scale.findRange(16)?.letter).toBe('A')
    expect(scale.findRange(21)).toBeUndefined()
  })

  test('derives passingScore from first passing range', () => {
    const scale = new GradeScale(baseArgs)
    expect(scale.passingScore).toBe(10)
  })

  test('persists decimalPlaces and description', () => {
    const scale = new GradeScale({
      ...baseArgs,
      decimalPlaces: 2,
      description: 'Barème standard français — note sur 20, seuil de réussite à 10.',
    })
    expect(scale.decimalPlaces).toBe(2)
    expect(scale.description).toBe('Barème standard français — note sur 20, seuil de réussite à 10.')
  })

  test('throws error if minScore exceeds maxScore', () => {
    expect(() => {
      new GradeScale({ ...baseArgs, minScore: 20, maxScore: 10 })
    }).toThrow('minScore must not exceed maxScore')
  })

  test('throws error if ranges array is empty', () => {
    expect(() => {
      new GradeScale({ ...baseArgs, ranges: [] })
    }).toThrow('ranges must contain at least one range')
  })

  test('throws error if range minScore exceeds its maxScore', () => {
    expect(() => {
      new GradeScale({
        ...baseArgs,
        ranges: [{ letter: 'A', minScore: 10, maxScore: 5, isPassing: false }],
      })
    }).toThrow('ranges[0].minScore must not exceed its maxScore')
  })

  test('throws error if range falls outside grade scale bounds', () => {
    expect(() => {
      new GradeScale({
        ...baseArgs,
        minScore: 10,
        maxScore: 20,
        ranges: [{ letter: 'A', minScore: 5, maxScore: 15, isPassing: false }],
      })
    }).toThrow('ranges[0] must fall within the grade scale bounds')

    expect(() => {
      new GradeScale({
        ...baseArgs,
        ranges: [{ letter: 'A', minScore: 5, maxScore: 25, isPassing: false }],
      })
    }).toThrow('ranges[0] must fall within the grade scale bounds')
  })

  test('throws error if ranges are not ordered by score', () => {
    expect(() => {
      new GradeScale({
        ...baseArgs,
        ranges: [
          { letter: 'C', minScore: 10, maxScore: 13.99, isPassing: true },
          { letter: 'F', minScore: 0, maxScore: 9.99, isPassing: false },
        ],
      })
    }).toThrow('ranges must be ordered by score and must not overlap')
  })

  test('throws error if ranges overlap', () => {
    expect(() => {
      new GradeScale({
        ...baseArgs,
        ranges: [
          { letter: 'F', minScore: 0, maxScore: 10.5, isPassing: false },
          { letter: 'C', minScore: 10, maxScore: 13.99, isPassing: true },
        ],
      })
    }).toThrow('ranges must be ordered by score and must not overlap')
  })
})
