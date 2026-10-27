import type { PGlite } from '@electric-sql/pglite'
import type { SQL } from 'drizzle-orm'
import process from 'node:process'
import { drizzle } from 'drizzle-orm/pglite'
import { MIGRATIONS_SCHEMA } from '../../src/lib/migration-meta'
import { seedCronJobSchedules } from '../../src/lib/seed-cron-job-schedules'
import { PostgresAtomicExecution } from '../../src/lib/transaction'
import { PostgresSchoolRepositories } from '../../src/postgres-school-repositories'
import { createRepositoryDatabase } from './authorization-database'

export type RepositoryDatabase = Awaited<ReturnType<typeof createRepositoryDatabase>>
export type DatabaseBaseline = 'empty' | 'initialized'

/** Owners release leases before closing their pool. Leases never share wrappers or test state. */
export function createDatabasePool(baseline: DatabaseBaseline = 'initialized') {
  const idle: PGlite[] = []
  const owned = new Set<PGlite>()
  const leases = new Map<RepositoryDatabase, PGlite>()
  const pending = new Set<Promise<void>>()
  let closed = false
  let initializations = 0
  let acquisitions = 0

  function wrap(db: PGlite): RepositoryDatabase {
    const connection = drizzle(db)
    return { db, connection, repositories: new PostgresSchoolRepositories(connection), atomic: new PostgresAtomicExecution(connection) }
  }

  async function reset(db: PGlite) {
    const { rows } = await db.query<{ schemaname: string, tablename: string }>(`SELECT schemaname, tablename FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema', $1) AND schemaname NOT LIKE 'pg_toast%'`, [MIGRATIONS_SCHEMA])
    const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
    const tables = rows.map(({ schemaname, tablename }) => `${quote(schemaname)}.${quote(tablename)}`)
    if (tables.length)
      await db.exec(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`)
    if (baseline === 'initialized') {
      const connection = drizzle(db)
      await seedCronJobSchedules({ execute: async query => connection.execute(query as SQL) })
    }
    // Reclaim relation files deferred by TRUNCATE before the next lease/shutdown.
    await db.exec('CHECKPOINT')
  }

  async function acquire(): Promise<RepositoryDatabase> {
    if (closed)
      throw new Error('Cannot acquire from a closed test database pool')
    let db = idle.pop()
    if (!db) {
      const fresh = await createRepositoryDatabase()
      db = fresh.db
      owned.add(db)
      initializations++
      try {
        if (closed)
          throw new Error('Test database pool closed during acquisition')
        if (baseline === 'empty')
          await reset(db)
      }
      catch (error) {
        try {
          await discard(db)
        }
        catch { /* Preserve initialization/reset failure. */ }
        throw error
      }
    }
    const fixture = wrap(db)
    leases.set(fixture, db)
    acquisitions++
    return fixture
  }

  async function discard(db: PGlite) {
    owned.delete(db)
    await db.close()
  }

  async function release(fixture: RepositoryDatabase): Promise<void> {
    const db = leases.get(fixture)
    if (!db)
      throw new Error('Test database lease is not active in this pool')
    leases.delete(fixture)
    const cleanup = (async () => {
      try {
        await reset(db)
        idle.push(db)
      }
      catch (error) {
        try {
          await discard(db)
        }
        catch { /* Preserve the reset error, never reuse the failed instance. */ }
        throw error
      }
    })()
    pending.add(cleanup)
    try {
      await cleanup
    }
    finally { pending.delete(cleanup) }
  }

  async function releaseAll() {
    const results = await Promise.allSettled([...leases.keys()].map(release))
    const errors = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map(result => result.reason)
    if (errors.length)
      throw new AggregateError(errors, 'Failed to reset test database leases')
  }

  async function close() {
    closed = true
    await Promise.allSettled([...pending])
    const leaked = leases.size
    leases.clear()
    idle.length = 0
    const results = await Promise.allSettled([...owned].map(discard))
    const errors = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map(result => result.reason)
    const { EDAYA_TEST_POOL_METRICS: metrics } = process.env
    if (metrics === 'true')
      process.stdout.write(`[test database pool] ${JSON.stringify({ baseline, initializations, acquisitions })}\n`)
    if (leaked)
      errors.push(new Error(`${leaked} unreleased test database lease(s)`))
    if (errors.length)
      throw new AggregateError(errors, 'Failed to close test database pool')
  }

  return { acquire, release, releaseAll, close, get statistics() {
    return { initializations, acquisitions }
  } }
}
