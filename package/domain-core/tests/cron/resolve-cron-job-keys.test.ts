import { describe, expect, test } from 'bun:test'
import { resolveCronJobKeys } from '../../src/cron/resolve-cron-job-keys'

describe('resolveCronJobKeys', () => {
  test('maps known cron expressions to job keys', () => {
    expect(resolveCronJobKeys('0 6 * * *')).toEqual(['processDueNotifications'])
    expect(resolveCronJobKeys('*/5 * * * *')).toEqual(['reconcilePendingDeliveries'])
    expect(resolveCronJobKeys('unknown')).toBeUndefined()
  })
})
