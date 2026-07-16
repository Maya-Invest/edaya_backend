import { DomainValidationError, isSameDate, parseDomain } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

describe('domain shared validation', () => {
  test('isSameDate compares UTC year, month, and day', () => {
    const d1 = new Date(Date.UTC(2026, 8, 1, 10, 0, 0))
    const d2 = new Date(Date.UTC(2026, 8, 1, 15, 0, 0))
    const d3 = new Date(Date.UTC(2026, 8, 2, 10, 0, 0))

    expect(isSameDate(d1, d2)).toBe(true)
    expect(isSameDate(d1, d3)).toBe(false)
  })

  test('parseDomain returns parsed data on success', () => {
    const schema = z.object({ name: z.string().min(1) })
    expect(parseDomain(schema, { name: 'Ada' })).toEqual({ name: 'Ada' })
  })

  test('parseDomain throws DomainValidationError with formatted message on failure', () => {
    const schema = z.object({ count: z.number().nonnegative() })
    expect(() => parseDomain(schema, { count: -1 })).toThrow(DomainValidationError)
    expect(() => parseDomain(schema, { count: -1 })).toThrow('count: Number must be greater than or equal to 0')
  })
})
