import { PostgresAtomicExecution as RelationalPostgresAtomicExecution, PostgresSchoolRepositories as RelationalPostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { setIntegrationTestAdapter } from '../utils/test-adapter'
import { createPostgresAppBuilder } from './postgres-school-headless-app'

function describePgliteIntegration(name: string, suite: () => void) {
  describe(`[Postgres PGlite] ${name}`, () => {
    let pglite: PGlite
    let db: any
    let repos: RelationalPostgresSchoolRepositories

    beforeAll(async () => {
      pglite = new PGlite()
      db = drizzle(pglite)
      repos = new RelationalPostgresSchoolRepositories(db)
      await repos.init({ driver: 'pglite' })
    })

    beforeEach(async () => {
      await repos.clearAll()
      const postgresBuilder = createPostgresAppBuilder(db, repos, RelationalPostgresAtomicExecution)
      setIntegrationTestAdapter({
        createApp: actor => postgresBuilder(actor),
      })
    })

    afterAll(async () => {
      if (pglite) {
        await pglite.close()
      }
    })

    suite()
  })
}

export function describeIntegration(name: string, suite: () => void) {
  describePgliteIntegration(name, suite)
}
