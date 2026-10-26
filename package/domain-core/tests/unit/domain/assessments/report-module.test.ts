import { ReportModule } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

const base = { id: 'module', schoolId: 'school', gradeLevelId: 'level', academicYearId: 'year', name: 'Science', order: 1 }
describe('ReportModule', () => {
  test('defaults to the sum of subject coefficients', () => {
    expect(new ReportModule(base).weightingMode).toBe('subject_coefficients')
  })
  test('explicit mode requires a finite positive weight', () => {
    for (const explicitWeight of [undefined, 0, -1, Infinity, NaN])
      expect(() => new ReportModule({ ...base, weightingMode: 'explicit', explicitWeight })).toThrow()
    expect(new ReportModule({ ...base, weightingMode: 'explicit', explicitWeight: 0.5 }).explicitWeight).toBe(0.5)
  })
  test('sum mode rejects an explicit weight', () => {
    expect(() => new ReportModule({ ...base, explicitWeight: 2 })).toThrow()
  })
  test('requires scope and a positive display order', () => {
    expect(() => new ReportModule({ ...base, gradeLevelId: '' })).toThrow()
    expect(() => new ReportModule({ ...base, order: -1 })).toThrow()
  })
})
