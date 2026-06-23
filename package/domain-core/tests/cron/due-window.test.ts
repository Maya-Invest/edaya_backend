import { describe, expect, test } from 'bun:test'
import { isInJobNotificationWindow } from '../../src/cron/due-window'

describe('isInJobNotificationWindow', () => {
  test('returns true when asOf is inside deliver window', () => {
    const eventAt = new Date('2026-06-20T00:00:00.000Z')
    const deliverAfter = new Date('2026-06-17T00:00:00.000Z')
    const asOf = new Date('2026-06-18T12:00:00.000Z')

    expect(isInJobNotificationWindow(deliverAfter, eventAt, asOf)).toBe(true)
  })

  test('returns false before deliverAfter', () => {
    const eventAt = new Date('2026-06-20T00:00:00.000Z')
    const deliverAfter = new Date('2026-06-17T00:00:00.000Z')
    const asOf = new Date('2026-06-16T12:00:00.000Z')

    expect(isInJobNotificationWindow(deliverAfter, eventAt, asOf)).toBe(false)
  })

  test('returns false after eventAt', () => {
    const eventAt = new Date('2026-06-20T00:00:00.000Z')
    const deliverAfter = new Date('2026-06-17T00:00:00.000Z')
    const asOf = new Date('2026-06-21T00:00:00.000Z')

    expect(isInJobNotificationWindow(deliverAfter, eventAt, asOf)).toBe(false)
  })
})
