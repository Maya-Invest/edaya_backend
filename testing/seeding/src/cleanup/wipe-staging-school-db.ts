import postgres from 'postgres'
import { assertStagingSchoolDatabaseUrl } from './database-url-guard'

export interface WipeStagingSchoolDbResult {
  tableCount: number
}

async function listPublicTables(sqlClient: postgres.Sql): Promise<string[]> {
  const tables = await sqlClient<Array<{ table_name: string }>>`
    SELECT tablename AS table_name
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '__drizzle%'
  `

  return tables.map(({ table_name }) => table_name)
}

export async function wipeStagingSchoolDatabase(databaseUrl: string): Promise<WipeStagingSchoolDbResult> {
  assertStagingSchoolDatabaseUrl(databaseUrl)

  const sqlClient = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 30,
    idle_timeout: 0,
    max_lifetime: 60 * 30,
  })

  try {
    const tableNames = await listPublicTables(sqlClient)
    if (tableNames.length === 0) {
      return { tableCount: 0 }
    }

    const quoted = tableNames
      .map(name => `"${name.replaceAll('"', '""')}"`)
      .join(', ')

    await sqlClient.unsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`)
    return { tableCount: tableNames.length }
  }
  finally {
    await sqlClient.end({ timeout: 5 })
  }
}
