import { describe, expect, test } from 'bun:test'
import { computeNextRunAt } from '../../src/capabilities/scheduling-jobs/compute-next-run-at'

describe('computeNextRunAt', () => {
  test('returns the next run after the reference time in UTC', () => {
    const after = new Date('2026-07-03T12:00:00.000Z')

    expect(computeNextRunAt('*/5 * * * *', after).toISOString()).toBe('2026-07-03T12:05:00.000Z')
    expect(computeNextRunAt('0 6 * * *', after).toISOString()).toBe('2026-07-04T06:00:00.000Z')
    expect(computeNextRunAt('0 2 * * *', after).toISOString()).toBe('2026-07-04T02:00:00.000Z')
  })
})
