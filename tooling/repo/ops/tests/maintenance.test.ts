import { expect, test } from 'bun:test'
import { stagingDatabaseTarget } from '../../db/lib/staging-validation'
import { identitySecrets, maintenanceOptions, purgeStaging } from '../maintenance'

test('maintenance rejects production, unconfirmed changes and unknown arguments', () => {
  expect(() => maintenanceOptions(['production', '--yes'])).toThrow()
  expect(() => maintenanceOptions(['staging'])).toThrow()
  expect(() => maintenanceOptions(['staging', '--dry-run', '--typo'])).toThrow()
  expect(maintenanceOptions(['staging', '--dry-run'])).toEqual({ recover: false, dryRun: true })
  expect(maintenanceOptions(['staging', '--yes', '--recover'])).toEqual({ recover: true, dryRun: false })
  expect(() => stagingDatabaseTarget('school', {})).toThrow()
})
test('maintenance validates credentials without exposing their values', () => {
  for (const value of [undefined, 'private-credential', '[]', '{"BETTER_AUTH_SECRET":"private-credential"}', JSON.stringify({ BETTER_AUTH_SECRET: 'x'.repeat(32), PAUSE_API: 'false' })])
    expect(() => identitySecrets(value)).toThrow('Missing or invalid STAGING_IDENTITY_SECRETS')
})
test('reset purges queued work and every authentication key batch before proceeding', async () => {
  const calls: {
    path: string
    method?: string
    body?: unknown
  }[] = []
  const batches = [[{ name: 'first' }], [{ name: 'second' }], []]
  await purgeStaging(async <T>(path: string, body?: unknown, method?: string) => {
    calls.push({ path, body, method })
    return (path.includes('/keys?') ? batches.shift() : {}) as T
  }, 'queue-id', 'namespace-id')
  expect(calls[0]).toEqual({ path: '/queues/queue-id/purge', body: { delete_messages_permanently: true }, method: 'POST' })
  expect(calls.filter(call => call.method === 'DELETE').map(call => call.body)).toEqual([['first'], ['second']])
  let requests = 0
  await expect(purgeStaging(async () => {
    requests++
    throw new Error('Network failed')
  }, 'queue-id', 'namespace-id')).rejects.toThrow('Network failed')
  expect(requests).toBe(1)
})
