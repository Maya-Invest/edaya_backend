import { PostgresAtomicExecution as RelationalPostgresAtomicExecution, PostgresSchoolRepositories as RelationalPostgresSchoolRepositories } from '@edaya/adaptor-postgres'
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

  // 2. Run with Relational Postgres DB
  describe(`[Relational Postgres DB] ${name}`, () => {
    let pglite: PGlite
    let db: any
    let repos: RelationalPostgresSchoolRepositories

    beforeEach(async () => {
      pglite = new PGlite()
      db = drizzle(pglite)
      repos = new RelationalPostgresSchoolRepositories(db)
      await repos.init()

      const postgresBuilder = createPostgresAppBuilder(db, repos, RelationalPostgresAtomicExecution)
      setIntegrationTestAdapter({
        createApp: actor => postgresBuilder(actor),
      })
    })

    suite()
  })

  // // 3. Run with Local Relational Postgres DB
  // describe(`[Relational Postgres Local DB] ${name}`, () => {
  //   let sqlClient: any
  //   let db: any
  //   let repos: RelationalPostgresSchoolRepositories

  //   beforeEach(async () => {
  //     const { SQL } = await import('bun')
  //     const { drizzle: bunDrizzle } = await import('drizzle-orm/bun-sql')

  //     sqlClient = new SQL('postgresql://admin:admin@localhost:5432/perf')
  //     db = bunDrizzle(sqlClient)
  //     repos = new RelationalPostgresSchoolRepositories(db)
  //     await repos.init()
  //     await repos.clearAll()

  //     const postgresBuilder = createPostgresAppBuilder(db, repos, RelationalPostgresAtomicExecution)
  //     setIntegrationTestAdapter({
  //       createApp: actor => postgresBuilder(actor),
  //     })
  //   })

  //   afterEach(async () => {
  //     if (sqlClient) {
  //       await sqlClient.close()
  //     }
  //   })

  //   suite()
  // })
}
