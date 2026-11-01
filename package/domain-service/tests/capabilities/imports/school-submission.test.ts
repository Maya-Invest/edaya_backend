/* eslint dot-notation: "off" -- Import snapshots are index-signature records. */
import { expect, test } from 'bun:test'
import { normalizeImportValues } from '../../../src/capabilities/imports/normalization'
import { schoolSubmissionFixture } from './fixtures/school-submission'

test('de-identified intake reconciles every supplied value without counting pending curriculum evidence as imported', () => {
  const fixture = schoolSubmissionFixture()
  expect(fixture.classes).toHaveLength(27)
  expect(fixture.students).toHaveLength(1144)
  const students = fixture.students.map(row => normalizeImportValues('students', row))
  expect(students.filter(row => row['isRepeating'] === true)).toHaveLength(231)
  expect(students.filter(row => row['isRepeating'] === false)).toHaveLength(913)
  expect(students[0]!['matricule']).toBe('000001')
  expect(fixture.teachers).toHaveLength(34)
  const teachers = fixture.teachers.map(row => normalizeImportValues('teachers', row))
  expect(teachers.filter(row => typeof row['declaredHours'] === 'number')).toHaveLength(32)
  expect(teachers.reduce((sum, row) => sum + Number(row['declaredHours'] ?? 0), 0)).toBe(649)
  expect(teachers.filter(row => row['declaredHours'] === null && row['hoursPeriod'] === 'unspecified')).toHaveLength(2)
  expect(fixture.coefficients).toHaveLength(156)
  expect(Object.fromEntries(['numeric', 'optional', 'alternative', 'dash', 'blank'].map(kind => [kind, fixture.coefficients.filter(cell => cell.kind === kind).length]))).toEqual({ numeric: 133, optional: 4, alternative: 2, dash: 11, blank: 6 })
  expect(fixture.totals).toHaveLength(12)
  expect(fixture.totals.filter(total => total.inconsistent)).toHaveLength(3)
  expect([...fixture.coefficients, ...fixture.totals].every(cell => cell.disposition === 'pending_review')).toBe(true)
})
