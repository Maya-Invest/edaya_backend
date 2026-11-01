/* eslint dot-notation: "off" -- Import snapshots use index signatures. */
import { describe, expect, test } from 'bun:test'
import { normalizeImportTable, normalizeImportValues } from '../../../src/capabilities/imports/normalization'

describe('Excel-friendly phone imports', () => {
  test.each(['guardians', 'teachers', 'staff'] as const)('%s normalizes only a leading phone prefix and retains raw cells', (type) => {
    const [row] = normalizeImportTable(type, { headers: ['phone', 'last_name', 'email'], rows: [{ row: 2, cells: [' #2250012345678 ', '#Name', '#tag@example.test'] }] })
    expect(row!.raw['phone']).toBe(' #2250012345678 ')
    expect(row!.values['phone']).toBe(' #2250012345678 ')
    expect(normalizeImportValues(type, row!.values)).toEqual({ phone: '+2250012345678', lastName: '#Name', email: '#tag@example.test' })
    expect(normalizeImportValues(type, { phone: '+225001#42' })['phone']).toBe('+225001#42')
    expect(normalizeImportValues(type, {})['phone']).toBeUndefined()
    expect(normalizeImportValues(type, { phone: '' })['phone']).toBeNull()
  })
  test('alternative phones use the same prefix rule', () => {
    expect(normalizeImportValues('guardians', { alternative_phone: ' #33612345678 ' })['alternativePhone']).toBe('+33612345678')
  })
})
