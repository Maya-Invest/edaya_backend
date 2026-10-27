import { createDatabasePool } from '../../../adaptor-postgres/tests/support/database-pool'

let pool: ReturnType<typeof createDatabasePool> | undefined

// The preload owns this pool; acquisition after teardown starts a new pool.
export async function resetServiceTestDatabases(): Promise<void> {
  await pool?.releaseAll()
}

export async function closeServiceTestDatabases(): Promise<void> {
  const current = pool
  pool = undefined
  await current?.close()
}

export async function acquireDatabase() {
  pool ??= createDatabasePool('empty')
  return pool.acquire()
}
