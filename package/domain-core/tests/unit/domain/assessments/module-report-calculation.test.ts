import { describe, expect, it } from 'bun:test'
import { calculateModuleReport, gradingPolicySchema, ReportModule, Subject } from '../../../../src'

const policy = gradingPolicySchema.parse({ academicYearId: 'year', revision: 1, mode: 'numeric-first', aggregateLabel: 'Average', status: 'completed', scale: {
  id: 'scale',
  schoolId: 'school',
  name: '/20',
  minScore: 0,
  maxScore: 20,
  decimalPlaces: 2,
  roundingMode: 'nearest',
  intervalConvention: 'continuous',
  ranges: [{ id: 'pass', minScore: 0, maxScore: 20, letter: 'A', interpretation: 'Pass' }],
} })
const module = (id: string, weight?: number) => new ReportModule({ id, schoolId: 'school', gradeLevelId: 'level', academicYearId: 'year', name: id, order: id === 'languages' ? 2 : 1, weightingMode: weight === undefined ? 'subject_coefficients' : 'explicit', explicitWeight: weight })
const row = (id: string, average: number | undefined, coefficient: number | undefined, reportModuleId?: string) => ({ subject: new Subject({ id, schoolId: 'school', gradeLevelId: 'level', academicYearId: 'year', name: id, coefficient, reportModuleId }), classSubjectId: `offering:${id}`, average })
const subjects = () => [row('maths', 16, 4, 'science'), row('physics', 10, 2, 'science'), row('languages', 12, 3, 'languages')]

describe('flat report module calculation', () => {
  it('preserves the direct subject weighted average in sum mode', () => {
    const result = calculateModuleReport([module('science'), module('languages')], subjects(), policy)
    expect(result.sectionResults[0]!.average).toBe(14)
    expect(result.sectionResults[0]!.weight).toBe(6)
    expect(result.overallAverage).toBeCloseTo(40 / 3, 10)
    const ungrouped = subjects().map(value => ({ ...value, subject: value.subject.copyWith({ reportModuleId: null }) }))
    expect(calculateModuleReport([], ungrouped, policy).overallAverage).toBeCloseTo(result.overallAverage!, 10)
  })

  it('uses explicit weights only at the module-to-overall step', () => {
    const result = calculateModuleReport([module('science', 3), module('languages')], subjects(), policy)
    expect(result.sectionResults[0]!.average).toBe(14)
    expect(result.sectionResults[0]!.contributingCoefficientSum).toBe(6)
    expect(result.sectionResults[0]!.weight).toBe(3)
    expect(result.overallAverage).toBe(13)
  })

  it('includes ungrouped subjects once alongside explicitly weighted modules', () => {
    expect(calculateModuleReport([module('science', 3), module('languages')], [...subjects(), row('arts', 18, 1)], policy).overallAverage).toBeCloseTo(96 / 7, 10)
  })

  it('derives sum weights from each student’s contributing subjects', () => {
    const values = subjects()
    values[1]!.average = undefined
    const result = calculateModuleReport([module('science'), module('languages')], values, policy)
    expect(result.sectionResults[0]!.weight).toBe(4)
    expect(result.overallAverage).toBeCloseTo(100 / 7, 10)
  })

  it('distinguishes a real zero from a missing result and excludes empty explicit modules', () => {
    const result = calculateModuleReport([module('empty', 100)], [row('missing', undefined, undefined, 'empty'), row('zero', 0, 2)], policy)
    expect(result.sectionResults[0]!.average).toBeUndefined()
    expect(result.sectionResults[0]!.weight).toBe(0)
    expect(result.sectionResults[1]!.weight).toBe(2)
    expect(result.overallAverage).toBe(0)
  })

  it('rejects missing contributing coefficients and duplicate or unknown memberships', () => {
    expect(() => calculateModuleReport([], [row('missing', 10, undefined)], policy)).toThrow('Set coefficients')
    expect(() => calculateModuleReport([], [row('x', 10, 1, 'other')], policy)).toThrow('Every assigned module')
    expect(() => calculateModuleReport([], [row('x', 10, 1), row('x', 10, 1)], policy)).toThrow('only once')
  })

  it('does not round intermediate subject or module values before aggregation', () => {
    const result = calculateModuleReport([module('decimal', 0.5)], [row('a', 10.004, 1, 'decimal'), row('b', 10.014, 1, 'decimal'), row('c', 12.008, 0.5)], policy)
    expect(result.overallAverage).toBeCloseTo(11.0085, 10)
  })
})
