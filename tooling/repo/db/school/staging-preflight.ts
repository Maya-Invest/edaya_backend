import process from 'node:process'
import postgres from 'postgres'

for (const [key, database, role] of [
  ['STAGING_DATABASE_URL', 'neondb', undefined],
  ['STAGING_AUTH_DATABASE_URL', 'edaya_identity', 'edaya_identity'],
] as const) {
  const sql = postgres(process.env[key] ?? '', { max: 1 })
  try {
    const [row] = await sql`SELECT current_database() AS database, current_user AS role`
    if (row?.['database'] !== database || (role && row?.['role'] !== role)) {
      throw new Error('Staging database or role mismatch')
    }
  }
  finally {
    await sql.end({ timeout: 5 })
  }
}
console.log('Both direct staging database connections verified')
