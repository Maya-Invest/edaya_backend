import type { ImportReferenceCandidate, ImportReferenceScope } from '@edaya/core'
import { normalizeReferenceText, resolveImportReference } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

const scope: ImportReferenceScope = { schoolId: 'school-a', entityType: 'subjects', academicYearId: 'year-a', gradeLevelId: 'grade-a' }
function subject(id: string, overrides: Partial<ImportReferenceCandidate> = {}): ImportReferenceCandidate {
  return { id, scope, name: 'Histoire et géographie', shortName: 'Hist.-Géo.', readable: true, ...overrides }
}
const assertions = [{ field: 'shortName' as const, value: 'hist.-géo.' }]

describe('v2 reference resolution', () => {
  test('does not allow human name matching or non-human business identifiers', () => {
    expect(() => resolveImportReference({ scope: { schoolId: 'school-a', entityType: 'students' }, assertions: [{ field: 'name', value: 'Ada' }], candidates: [] })).toThrow()
    expect(() => resolveImportReference({ scope, assertions: [{ field: 'identifier', value: 'MATH' }], candidates: [] })).toThrow()
    expect(() => resolveImportReference({ scope: { schoolId: 'school-a', entityType: 'unknown' }, assertions, candidates: [] })).toThrow()
  })
  test('uses full locale-independent folding without stripping accents or compatibility characters', () => {
    expect(normalizeReferenceText('  STRAẞE  ')).toBe(normalizeReferenceText('Straße'))
    expect(normalizeReferenceText('ΟΣ')).toBe(normalizeReferenceText('ος'))
    expect(normalizeReferenceText('Ge\u0301o.\u00A0 A')).toBe(normalizeReferenceText('GÉO. A'))
    expect(normalizeReferenceText('Géo')).not.toBe(normalizeReferenceText('Geo'))
    expect(normalizeReferenceText('Ａ')).not.toBe(normalizeReferenceText('A'))
    expect(normalizeReferenceText('ı')).not.toBe(normalizeReferenceText('I'))
  })

  test('requires year and grade, and never widens a supplied scope', () => {
    expect(() => resolveImportReference({ scope: { schoolId: 'school-a', entityType: 'subjects' }, assertions, candidates: [] })).toThrow()
    expect(resolveImportReference({ scope, assertions, candidates: [subject('other-year', { scope: { ...scope, academicYearId: 'year-b' } })] })).toEqual({ status: 'unresolved', candidates: [] })
    expect(resolveImportReference({ scope, assertions, candidates: [subject('other-school', { scope: { ...scope, schoolId: 'school-b' } })] })).toEqual({ status: 'unresolved', candidates: [] })
  })

  test('matches only the declared field and never treats text as an internal ID', () => {
    expect(resolveImportReference({ scope, assertions, candidates: [subject('hist.-géo.', { shortName: 'Other', name: 'hist.-géo.' })] })).toEqual({ status: 'unresolved', candidates: [] })
    expect(resolveImportReference({ scope, assertions: [{ field: 'id', value: 'EXACT' }], candidates: [subject('exact')] })).toEqual({ status: 'unresolved', candidates: [] })
  })

  test('deduplicates staged and persisted references by internal ID', () => {
    expect(resolveImportReference({ scope, assertions, candidates: [subject('one'), subject('one')] })).toEqual({ status: 'resolved', targetId: 'one', origin: 'automatic' })
  })

  test('requires an explicit choice for duplicate display values', () => {
    const candidates = [subject('one'), subject('two')]
    expect(resolveImportReference({ scope, assertions, candidates }).status).toBe('ambiguous')
    expect(resolveImportReference({ scope, assertions, candidates, selectedId: 'two' })).toEqual({ status: 'resolved', targetId: 'two', origin: 'explicit' })
  })

  test('hidden candidates prevent automatic resolution without being disclosed', () => {
    const candidates = [subject('visible'), subject('secret', { readable: false })]
    expect(resolveImportReference({ scope, assertions, candidates })).toEqual({ status: 'ambiguous', candidates: [candidates[0]!] })
    expect(resolveImportReference({ scope, assertions, candidates, selectedId: 'secret' })).toEqual({ status: 'unresolved', candidates: [] })
    expect(resolveImportReference({ scope, assertions, candidates, selectedId: 'visible' })).toEqual({ status: 'resolved', targetId: 'visible', origin: 'explicit' })
  })

  test('all assertions must agree even when an ID is explicit', () => {
    const candidates = [subject('one'), subject('two', { shortName: 'Math' })]
    expect(resolveImportReference({ scope, assertions: [...assertions, { field: 'id', value: 'two' }], candidates })).toEqual({ status: 'conflicting', candidates: [] })
    expect(resolveImportReference({ scope, assertions: [...assertions, { field: 'id', value: 'one' }], candidates })).toEqual({ status: 'resolved', targetId: 'one', origin: 'explicit' })
  })

  test('human identifiers preserve leading zeros and group boundaries', () => {
    const humanScope = { schoolId: 'school-a', entityType: 'students' }
    const candidate = { id: 'one', scope: humanScope, identifier: '000127', readable: true }
    expect(resolveImportReference({ scope: humanScope, assertions: [{ field: 'identifier', value: '０００１２７' }], candidates: [candidate] })).toEqual({ status: 'resolved', targetId: 'one', origin: 'automatic' })
    expect(resolveImportReference({ scope: { ...humanScope, entityType: 'teachers' }, assertions: [{ field: 'identifier', value: '000127' }], candidates: [candidate] })).toEqual({ status: 'unresolved', candidates: [] })
  })
})
