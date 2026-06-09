import { describe, expect, test } from 'bun:test'
import {
  isSameDate,
  requireNonNegativeNumber,
  requireTimeOfDay,
} from '../../../src/domains/utils'

describe('Utils', () => {
  test('requireNonNegativeNumber throws on negative numbers', () => {
    expect(() => requireNonNegativeNumber(-1, 'test')).toThrow('test must be a finite, non-negative number')
  })

  test('requireNonNegativeNumber throws on non-finite numbers', () => {
    expect(() => requireNonNegativeNumber(Number.NaN, 'test')).toThrow('test must be a finite, non-negative number')
    expect(() => requireNonNegativeNumber(Infinity, 'test')).toThrow('test must be a finite, non-negative number')
  })

  test('requireNonNegativeNumber passes on zero and positive numbers', () => {
    expect(requireNonNegativeNumber(0, 'test')).toBe(0)
    expect(requireNonNegativeNumber(10, 'test')).toBe(10)
  })

  test('requireTimeOfDay throws on invalid formats', () => {
    expect(() => requireTimeOfDay('25:00', 'time')).toThrow('time must be a valid time in HH:mm format')
    expect(() => requireTimeOfDay('08:60', 'time')).toThrow('time must be a valid time in HH:mm format')
    expect(() => requireTimeOfDay('8:00', 'time')).toThrow('time must be a valid time in HH:mm format') // Missing leading zero
  })

  test('requireTimeOfDay passes on valid formats', () => {
    expect(requireTimeOfDay('08:00', 'time')).toBe('08:00')
    expect(requireTimeOfDay('23:59', 'time')).toBe('23:59')
  })

  test('isSameDate compares UTC year, month, and day', () => {
    const d1 = new Date(Date.UTC(2026, 8, 1, 10, 0, 0))
    const d2 = new Date(Date.UTC(2026, 8, 1, 15, 0, 0))
    const d3 = new Date(Date.UTC(2026, 8, 2, 10, 0, 0))

    expect(isSameDate(d1, d2)).toBe(true)
    expect(isSameDate(d1, d3)).toBe(false)
  })
})
