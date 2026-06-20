import { PostgresAtomicExecution as RelationalPostgresAtomicExecution, PostgresSchoolRepositories as RelationalPostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { setIntegrationTestAdapter } from '../utils/test-adapter'
import { getIntegrationTestConfig } from './integration-test-config'
import { createPostgresAppBuilder } from './postgres-school-headless-app'
import { getSharedPostgresTestDatabase, resetPostgresTestDatabase } from './postgres-test-database'

const integrationTestConfig = getIntegrationTestConfig()

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

function _describeRemotePostgresIntegration(name: string, suite: () => void) {
  describe(`[Postgres Remote] ${name}`, () => {
    let db: any
    let repos: RelationalPostgresSchoolRepositories

    beforeAll(async () => {
      const databaseUrl = integrationTestConfig.databaseUrl
      if (!databaseUrl) {
        throw new Error('DATABASE_URL is required for remote integration tests')
      }

      const handle = await getSharedPostgresTestDatabase(databaseUrl)
      db = handle.db
      repos = handle.repositories
    })

    beforeEach(async () => {
      const databaseUrl = integrationTestConfig.databaseUrl
      if (!databaseUrl) {
        throw new Error('DATABASE_URL is required for remote integration tests')
      }

      let handle = await getSharedPostgresTestDatabase(databaseUrl)
      handle = await resetPostgresTestDatabase(handle)
      db = handle.db
      repos = handle.repositories

      const postgresBuilder = createPostgresAppBuilder(db, repos, RelationalPostgresAtomicExecution)
      setIntegrationTestAdapter({
        createApp: actor => postgresBuilder(actor),
      })
    })

    suite()
  })
}

export function describeIntegration(name: string, suite: () => void) {
  describePgliteIntegration(name, suite)

  // Remote Neon/Postgres suites are disabled for now — local PGlite only.
  // To re-enable: uncomment below and run `bun run test:remote` with DATABASE_URL set.
  // if (integrationTestConfig.runRemotePostgres) {
  //   _describeRemotePostgresIntegration(name, suite)
  // }
}
