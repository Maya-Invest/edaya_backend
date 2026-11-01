import { describe, expect, test } from 'bun:test'
import { applyImportCollection, applyImportScalars, parseImportDate, resolveImportExistingMode } from '../../../src/index'

describe('import existing-record policy', () => {
  test('defaults to M and accepts only normalized S/M/O row overrides', () => {
    expect(resolveImportExistingMode(undefined)).toBe('M')
    expect(resolveImportExistingMode('   ', 'O')).toBe('O')
    expect(resolveImportExistingMode(' m ', 'S')).toBe('M')
    expect(() => resolveImportExistingMode('merge')).toThrow()
    expect(() => resolveImportExistingMode(false)).toThrow()
  })
  test('preserves missing fields and distinguishes blanks, zero and false', () => {
    const before = { name: 'Original', hours: 4, repeating: true, nationality: 'CI' }
    expect(applyImportScalars(before, { name: '  ', hours: 0, repeating: false }, 'M', new Set())).toEqual({ ...before, hours: 0, repeating: false })
    expect(applyImportScalars(before, { nationality: '' }, 'O', new Set(['nationality']))).toEqual({ ...before, nationality: null })
    expect(applyImportScalars(before, { name: 'New' }, 'S', new Set())).toEqual(before)
    expect(() => applyImportScalars(before, { name: '' }, 'O', new Set())).toThrow()
  })
  test('partial collections never remove unmentioned children', () => {
    const before = [{ id: 'a', primary: true }, { id: 'b', primary: false }]
    const after = [{ id: 'b', primary: true }]
    expect(applyImportCollection(before, after, 'O', false, row => row.id)).toEqual([before[0]!, after[0]!])
    expect(applyImportCollection(before, after, 'O', true, row => row.id)).toEqual(after)
    expect(applyImportCollection(before, [], 'M', true, row => row.id)).toEqual(before)
  })
  test('requires civil dates and rejects impossible or future birth dates', () => {
    expect(parseImportDate('2024-02-29')).toBe('2024-02-29')
    for (const value of ['2025-02-29', '01/02/2025', '2026-13-01'])
      expect(() => parseImportDate(value)).toThrow()
    expect(() => parseImportDate('2099-01-01', true, new Date('2026-01-01'))).toThrow()
  })
})
