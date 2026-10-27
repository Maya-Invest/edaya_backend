import { expect, test } from 'bun:test'
import { acquireDatabase, resetServiceTestDatabases } from './database-pool'

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
  expect(next.db).toBe(first.db)
  expect(next.repositories).not.toBe(first.repositories)
  expect(next.atomic).not.toBe(first.atomic)
  expect(await next.repositories.schools.count()).toBe(0)
})

test('repeated resets reclaim deferred relation files before final teardown', async () => {
  const fixture = await acquireDatabase()
  const relationFileCount = async () => {
    const { rows } = await fixture.db.query<{ count: number }>(`SELECT count(*)::integer AS count
      FROM pg_ls_dir('base/' || (SELECT oid FROM pg_database WHERE datname = current_database()))`)
    return rows[0]!.count
  }
  await resetServiceTestDatabases()
  const baseline = await relationFileCount()
  for (let i = 0; i < 3; i++) {
    expect((await acquireDatabase()).db).toBe(fixture.db)
    await fixture.db.exec('INSERT INTO schools (id, name, short_name, time_zone, created_at) VALUES (\'reset-check\', \'Fixture\', \'Fixture\', \'UTC\', now())')
    await resetServiceTestDatabases()
    expect(await fixture.repositories.schools.count()).toBe(0)
    // Allow catalog bookkeeping without allowing another generation of all
    // table/index files to accumulate (hundreds of files per reset).
    expect(await relationFileCount()).toBeLessThanOrEqual(baseline + 32)
  }
})
