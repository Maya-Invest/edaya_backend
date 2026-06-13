import { PostgresSchoolRepositories } from '@edaya/adaptor-neon'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export interface PostgresTestDatabaseHandle {
  db: ReturnType<typeof drizzle>
  sqlClient: postgres.Sql
  repositories: PostgresSchoolRepositories
}

let sharedHandle: Promise<PostgresTestDatabaseHandle> | undefined
let configuredDatabaseUrl: string | undefined

export async function getSharedPostgresTestDatabase(databaseUrl: string): Promise<PostgresTestDatabaseHandle> {
  configuredDatabaseUrl = databaseUrl

  if (!sharedHandle) {
    sharedHandle = createPostgresTestDatabase(databaseUrl)
  }

  return sharedHandle
}

function createSqlClient(databaseUrl: string): postgres.Sql {
  return postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 30,
    idle_timeout: 0,
    max_lifetime: 60 * 30,
  })
}

async function createPostgresTestDatabase(databaseUrl: string): Promise<PostgresTestDatabaseHandle> {
  const sqlClient = createSqlClient(databaseUrl)
  const db = drizzle(sqlClient)
  const repositories = new PostgresSchoolRepositories(db)

  await repositories.init({ driver: 'postgres-js' })

  return { db, sqlClient, repositories }
}

let cachedPublicTableList: string | undefined
let resetQueue: Promise<PostgresTestDatabaseHandle> | undefined

async function truncatePublicTables(sqlClient: postgres.Sql): Promise<void> {
  if (!cachedPublicTableList) {
    const tables = await sqlClient<Array<{ table_name: string }>>`
      SELECT tablename AS table_name
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE '__drizzle%'
    `

    cachedPublicTableList = tables.length === 0
      ? ''
      : tables.map(({ table_name }) => `"${table_name.replaceAll('"', '""')}"`).join(', ')
  }

  if (!cachedPublicTableList) {
    return
  }

  await sqlClient.unsafe(`TRUNCATE TABLE ${cachedPublicTableList} RESTART IDENTITY CASCADE`)
}

export async function resetPostgresTestDatabase(
  handle: PostgresTestDatabaseHandle,
): Promise<PostgresTestDatabaseHandle> {
  const reset = async (): Promise<PostgresTestDatabaseHandle> => {
    try {
      await truncatePublicTables(handle.sqlClient)
      return handle
    }
    catch {
      cachedPublicTableList = undefined
      await disposeSharedPostgresTestDatabase()

      if (!configuredDatabaseUrl) {
        throw new Error('DATABASE_URL is required to reconnect Postgres integration tests')
      }

      sharedHandle = createPostgresTestDatabase(configuredDatabaseUrl)
      return await sharedHandle
    }
  }

  resetQueue = (resetQueue ?? Promise.resolve(handle)).then(reset, reset)
  return resetQueue
}

export async function disposeSharedPostgresTestDatabase(): Promise<void> {
  if (!sharedHandle) {
    return
  }

  const handle = await sharedHandle
  await handle.sqlClient.end({ timeout: 5 })
  sharedHandle = undefined
}
