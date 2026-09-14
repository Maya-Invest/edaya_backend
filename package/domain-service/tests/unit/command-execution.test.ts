import { describe, expect, test } from 'bun:test'
import { digestCommandRequest, normalizeCommandRequest } from '../../src/services/commands/command-execution'

describe('normalized command request identity', () => {
  test('normalizes object order, parsed dates and omitted optional fields while retaining array order', async () => {
    const original = { amount: 12, date: new Date('2026-09-14T00:00:00Z'), nested: { b: 2, a: 1 }, unused: undefined }
    const reordered = { nested: { a: 1, b: 2 }, date: '2026-09-14T00:00:00.000Z', amount: 12 }
    expect(await digestCommandRequest(original)).toBe(await digestCommandRequest(reordered))
    expect(await digestCommandRequest([1, 2])).not.toBe(await digestCommandRequest([2, 1]))
    expect(await digestCommandRequest({ amount: 13 })).not.toBe(await digestCommandRequest({ amount: 12 }))
    expect(await digestCommandRequest(original)).toMatch(/^[0-9a-f]{64}$/)
  })

  test.each([NaN, Infinity, undefined, 1n, new Map(), new Date('invalid'), [undefined], Array.from({ length: 1 })])('rejects non-JSON input: %s', (value) => {
    expect(() => normalizeCommandRequest(value)).toThrow()
  })

  test('rejects cycles but accepts shared non-cyclic objects', () => {
    const cycle: { self?: unknown } = {}
    cycle.self = cycle
    expect(() => normalizeCommandRequest(cycle)).toThrow('acyclic')
    expect(normalizeCommandRequest([{}, {}])).toBe('[{},{}]')
    const shared = { value: 1 }
    expect(normalizeCommandRequest([shared, shared])).toBe('[{"value":1},{"value":1}]')
  })
})
