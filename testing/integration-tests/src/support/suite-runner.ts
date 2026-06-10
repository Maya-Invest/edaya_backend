import { PostgresAtomicExecution as RelationalPostgresAtomicExecution, PostgresSchoolRepositories as RelationalPostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { setIntegrationTestAdapter } from '../utils/test-adapter'
import { createPostgresAppBuilder } from './postgres-school-headless-app'

export function describeIntegration(name: string, suite: () => void) {
  // Run with PGlite (in-memory Postgres)
  describe(`[Postgres PGlite] ${name}`, () => {
    let pglite: PGlite
    let db: any
    let repos: RelationalPostgresSchoolRepositories

    beforeEach(async () => {
      pglite = new PGlite()
      db = drizzle(pglite)
      repos = new RelationalPostgresSchoolRepositories(db)
      await repos.init({ driver: 'pglite' })

      const postgresBuilder = createPostgresAppBuilder(db, repos, RelationalPostgresAtomicExecution)
      setIntegrationTestAdapter({
        createApp: actor => postgresBuilder(actor),
      })
    })

    afterEach(async () => {
      if (pglite) {
        await pglite.close()
      }
    })

    suite()
  })
}
