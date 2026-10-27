import type { PGlite } from '@electric-sql/pglite'
import type { RepositoryDatabase } from './database-pool'
import { afterAll, afterEach } from 'bun:test'
import { seedAuthorizationPlacement } from './authorization-database'
import { createDatabasePool } from './database-pool'

/** Call once at file scope so hooks belong to this file, including beforeEach leases. */
export function usePooledDatabases() {
  const pool = createDatabasePool('initialized')
  const active = new Map<PGlite, RepositoryDatabase>()
  async function createRepositoryDatabase() {
    const fixture = await pool.acquire()
    active.set(fixture.db, fixture)
    return fixture
  }
  async function releaseDatabase(db: PGlite) {
    const fixture = active.get(db)
    if (fixture) {
      active.delete(db)
      await pool.release(fixture)
    }
  }
  afterEach(async () => {
    try {
      await pool.releaseAll()
    }
    finally { active.clear() }
  })
  afterAll(() => pool.close())
  return {
    createRepositoryDatabase,
    releaseDatabase,
    async createAuthorizationDatabase() {
      const fixture = await createRepositoryDatabase()
      await seedAuthorizationPlacement(fixture.db)
      return fixture
    },
  }
}
