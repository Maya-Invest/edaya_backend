import { expect, test } from 'bun:test'
import { createDatabasePool } from './support/database-pool'

const cronCount = async (fixture: Awaited<ReturnType<ReturnType<typeof createDatabasePool>['acquire']>>) => (await fixture.db.query<{ count: number }>('SELECT count(*)::integer AS count FROM cron_job_schedules')).rows[0]!.count

const insertSchool = 'INSERT INTO schools (id, name, short_name, time_zone, created_at) VALUES (\'pool-school\', \'Fixture\', \'Fixture\', \'UTC\', now())'

test('leases reuse migrated storage but recreate wrappers and restore initialized defaults', async () => {
  const pool = createDatabasePool('initialized')
  try {
    const first = await pool.acquire()
    const initialCronCount = await cronCount(first)
    expect(initialCronCount).toBeGreaterThan(0)
    await first.db.exec(insertSchool)
    await first.db.exec('DELETE FROM cron_job_schedules')
    await pool.release(first)
    const second = await pool.acquire()
    expect(second.db).toBe(first.db)
    expect(second.connection).not.toBe(first.connection)
    expect(second.repositories).not.toBe(first.repositories)
    expect(second.atomic).not.toBe(first.atomic)
    expect(await second.repositories.schools.count()).toBe(0)
    expect(await cronCount(second)).toBe(initialCronCount)
    expect(pool.statistics).toEqual({ initializations: 1, acquisitions: 2 })
    await pool.release(second)
  }
  finally {
    await pool.releaseAll()
    await pool.close()
  }
})

test('empty baseline omits initialized defaults on both first and subsequent leases', async () => {
  const pool = createDatabasePool('empty')
  try {
    const first = await pool.acquire()
    expect(await cronCount(first)).toBe(0)
    await first.db.exec(insertSchool)
    await pool.release(first)
    const second = await pool.acquire()
    expect(await second.repositories.schools.count()).toBe(0)
    expect(await cronCount(second)).toBe(0)
    await pool.release(second)
  }
  finally {
    await pool.releaseAll()
    await pool.close()
  }
})

test('simultaneous leases use independent databases and a lease cannot be released twice', async () => {
  const pool = createDatabasePool()
  try {
    const [a, b] = await Promise.all([pool.acquire(), pool.acquire()])
    expect(a.db).not.toBe(b.db)
    await a.db.exec(insertSchool)
    expect(await b.repositories.schools.count()).toBe(0)
    await pool.release(a)
    await expect(pool.release(a)).rejects.toThrow('not active')
    await pool.release(b)
  }
  finally {
    await pool.releaseAll()
    await pool.close()
  }
})

test('reset failures discard storage instead of returning it to the pool', async () => {
  const pool = createDatabasePool()
  try {
    const first = await pool.acquire()
    await first.db.close()
    await expect(pool.release(first)).rejects.toThrow()
    const next = await pool.acquire()
    expect(next.db).not.toBe(first.db)
    expect(pool.statistics.initializations).toBe(2)
    await pool.release(next)
  }
  finally {
    await pool.releaseAll()
    await pool.close()
  }
})

test('close shuts down and reports unreleased leases and prevents further acquisition', async () => {
  const pool = createDatabasePool()
  const fixture = await pool.acquire()
  await expect(pool.close()).rejects.toThrow('Failed to close test database pool')
  expect(fixture.db.closed).toBe(true)
  await expect(pool.acquire()).rejects.toThrow('closed')
})

test('release resets identity sequences and checkpoints deferred relation files', async () => {
  const pool = createDatabasePool()
  const first = await pool.acquire()
  // Dedicated table stays within this pool; migration/schema suites still use fresh databases.
  await first.db.exec('CREATE TABLE pool_sequence (id serial PRIMARY KEY)')
  const files = async () => (await first.db.query<{ count: number }>('SELECT count(*)::integer AS count FROM pg_ls_dir(\'base/\' || (SELECT oid FROM pg_database WHERE datname = current_database()))')).rows[0]!.count
  try {
    await pool.release(first)
    const baseline = await files()
    for (let i = 0; i < 3; i++) {
      const fixture = await pool.acquire()
      expect((await fixture.db.query<{ id: number }>('INSERT INTO pool_sequence DEFAULT VALUES RETURNING id')).rows[0]!.id).toBe(1)
      await pool.release(fixture)
      expect(await files()).toBeLessThanOrEqual(baseline + 32)
    }
  }
  finally {
    await pool.releaseAll()
    await pool.close()
  }
})

test('reset clears secondary application schemas while preserving migration history', async () => {
  const pool = createDatabasePool()
  try {
    const first = await pool.acquire()
    const journal = await first.db.query('SELECT * FROM drizzle.__drizzle_migrations_school')
    expect(journal.rows.length).toBeGreaterThan(0)
    await first.db.exec('CREATE SCHEMA IF NOT EXISTS notify; CREATE TABLE notify.pool_isolation (id serial PRIMARY KEY, payload text); INSERT INTO notify.pool_isolation (payload) VALUES (\'previous test\')')
    await pool.release(first)
    const next = await pool.acquire()
    expect((await next.db.query('SELECT * FROM notify.pool_isolation')).rows).toEqual([])
    expect((await next.db.query('SELECT * FROM drizzle.__drizzle_migrations_school')).rows).toEqual(journal.rows)
    expect((await next.db.query<{ id: number }>('INSERT INTO notify.pool_isolation (payload) VALUES (\'new test\') RETURNING id')).rows[0]!.id).toBe(1)
    await pool.release(next)
  }
  finally {
    await pool.releaseAll()
    await pool.close()
  }
})
