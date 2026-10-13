import { calculateGrade, describeGrade, GradeScale, gradingPolicySchema, roundGrade, weightedGrade } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

const scale = {
  id: 'points',
  schoolId: 'school',
  name: 'Points',
  minScore: 0,
  maxScore: 4,
  decimalPlaces: 2,
  intervalConvention: 'continuous' as const,
  ranges: [
    { id: 'fail', letter: 'F', interpretation: 'Insuffisant', minScore: 0, maxScore: 2, isPassing: false, gpaValue: 0 },
    { id: 'pass', letter: 'B', interpretation: 'Bien', minScore: 2, maxScore: 3.5, isPassing: true, gpaValue: 3 },
    { id: 'excellent', letter: 'A', interpretation: 'Excellent', minScore: 3.5, maxScore: 4, isPassing: true, gpaValue: 4 },
  ],
}
const policy = gradingPolicySchema.parse({ academicYearId: 'year', revision: 1, mode: 'mention-first', aggregateLabel: 'GPA', scale })

describe('grading policies', () => {
  test('continuous intervals assign shared boundaries to the upper interval and include the final maximum', () => {
    const model = new GradeScale(scale)
    expect([0, 1.999, 2, 3.5, 4].map(value => model.findRange(value)?.letter)).toEqual(['F', 'F', 'B', 'A', 'A'])
    expect(model.findRange(4.01)).toBeUndefined()
    expect(() => new GradeScale({ ...scale, ranges: scale.ranges.slice(1) })).toThrow('entire scale')
    expect(() => new GradeScale({ ...scale, ranges: scale.ranges.map((row, index) => index === 1 ? { ...row, minScore: 1.99 } : row) })).toThrow()
  })
  test('normalizes mixed evaluation maxima, keeps full precision and weights points', () => {
    const numeric = { ...policy, mode: 'numeric-first' as const }
    const a = calculateGrade({ kind: 'numeric', value: 7, maximum: 10 }, numeric)
    const b = calculateGrade({ kind: 'numeric', value: 16, maximum: 20 }, numeric)
    expect(weightedGrade([{ value: a.value, coefficient: 1 }, { value: b.value, coefficient: 3 }])).toBeCloseTo(3.1)
    expect(calculateGrade({ kind: 'numeric', value: 1, maximum: 3 }, numeric).value).toBeCloseTo(4 / 3, 12)
  })
  test('averages mention points without replacing the average by a mention’s assigned points', () => {
    const values = ['pass', 'excellent'].map(intervalId => calculateGrade({ kind: 'mention', intervalId, code: intervalId, label: intervalId, policyRevision: 1, points: 99 }, policy))
    const average = weightedGrade(values.map(row => ({ value: row.value, coefficient: 1 })))!
    expect(average).toBe(3.5)
    expect(describeGrade(average, policy).mention.code).toBe('A')
    expect(describeGrade(average, policy).reportedValue).toBe(3.5)
  })
  test('rounds once before matching and truncates at the configured precision', () => {
    expect(describeGrade(3.499, policy).mention.code).toBe('A')
    const truncated = { ...policy, scale: { ...policy.scale, roundingMode: 'truncate' as const } }
    expect(describeGrade(3.499, truncated).reportedValue).toBe(3.49)
    expect(describeGrade(3.499, truncated).mention.code).toBe('B')
    expect(roundGrade(1.005, { decimalPlaces: 2, roundingMode: 'nearest' })).toBe(1.01)
  })
  test('requires explicit numeric equivalents and preserves the original mention', () => {
    const entry = { kind: 'mention' as const, intervalId: 'pass', policyRevision: 1, code: 'B', label: 'Bien', points: 3 }
    const numeric = { ...policy, mode: 'numeric-first' as const, revision: 2 }
    expect(() => calculateGrade(entry, numeric)).toThrow('EQUIVALENT_REQUIRED')
    expect(calculateGrade(entry, { ...numeric, numericEquivalents: { '1:pass': 2.7 } }).value).toBe(2.7)
    expect(entry.points).toBe(3)
  })
  test('a removed mention retains its original assigned points', () => {
    const entry = { kind: 'mention' as const, intervalId: 'pass', policyRevision: 1, code: 'B', label: 'Bien', points: 3 }
    const revised = { ...policy, revision: 2, scale: { ...policy.scale, ranges: policy.scale.ranges.map(range => range.id === 'pass' ? { ...range, id: 'replacement', gpaValue: 2.5 } : range) } }
    expect(calculateGrade(entry, revised).value).toBe(3)
    expect(entry.intervalId).toBe('pass')
  })
  test('ordinary scale edits retain authored intervals, identifiers and points', () => {
    expect(new GradeScale({ ...scale, name: 'Renamed' }).ranges).toEqual(new GradeScale(scale).ranges)
  })
  test('rejects a scale whose maximum rounds outside its intervals, while retaining legacy readers', () => {
    const fractional = { ...scale, maxScore: 4.35, decimalPlaces: 1, ranges: scale.ranges.map((range, index) => index === 2 ? { ...range, maxScore: 4.35 } : range) }
    expect(() => new GradeScale(fractional)).toThrow('configured precision')
    expect(new GradeScale({ ...fractional, decimalPlaces: 2 }).maxScore).toBe(4.35)
    expect(new GradeScale({ ...fractional, intervalConvention: 'legacy-closed', ranges: [{ letter: 'A', minScore: 0, maxScore: 4.35, isPassing: true }] }).maxScore).toBe(4.35)
  })
})
