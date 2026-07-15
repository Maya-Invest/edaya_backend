import postgres from 'postgres'

const RESET_SQL = `
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
`

export async function resetRemoteDatabase(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 30,
    idle_timeout: 0,
    max_lifetime: 60 * 30,
  })

  try {
    await sql.unsafe(RESET_SQL)
  }
  finally {
    await sql.end({ timeout: 5 })
  }
}
