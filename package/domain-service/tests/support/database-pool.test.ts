import { expect, test } from 'bun:test'
import { acquireDatabase } from './database-pool'

let first: Awaited<ReturnType<typeof acquireDatabase>>

// These sequential tests exercise the runner's preload, not manual cleanup.
// Without the package bunfig, each test retained another Wasm database.
test('service test fixture can persist data during a test', async () => {
  first = await acquireDatabase()
  await first.db.exec('INSERT INTO schools (id, name, short_name, time_zone, created_at) VALUES (\'pool-cleanup-check\', \'Fixture\', \'Fixture\', \'UTC\', now())')
  expect(await first.repositories.schools.count()).toBe(1)
})

test('the next service test receives the same emptied database', async () => {
  const next = await acquireDatabase()
  expect(next === first).toBe(true)
  expect(await next.repositories.schools.count()).toBe(0)
})
