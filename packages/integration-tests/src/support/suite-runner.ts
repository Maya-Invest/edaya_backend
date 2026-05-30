import { PostgresSchoolRepositories } from '@edaya/adaptor-postgres-json'
import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { createInMemoryTestApp, setIntegrationTestAdapter } from './in-memory-school-headless-app'
import { createPostgresAppBuilder } from './postgres-school-headless-app'

export function describeIntegration(name: string, suite: () => void) {
  // 1. Run with In-Memory DB
  describe(`[InMemory DB] ${name}`, () => {
    beforeEach(() => {
      setIntegrationTestAdapter({
        createApp: actor => createInMemoryTestApp(actor),
      })
    })
    suite()
  })

  // 2. Run with Postgres DB
  describe(`[Postgres DB] ${name}`, () => {
    let pglite: PGlite
    let db: any
    let repos: PostgresSchoolRepositories

    beforeEach(async () => {
      pglite = new PGlite()
      db = drizzle(pglite)
      repos = new PostgresSchoolRepositories(db)
      await repos.init()

      const postgresBuilder = createPostgresAppBuilder(db, repos)
      setIntegrationTestAdapter({
        createApp: actor => postgresBuilder(actor),
      })
    })

    suite()
  })
}
