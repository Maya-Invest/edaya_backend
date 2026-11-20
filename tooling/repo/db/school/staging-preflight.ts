import process from 'node:process'
import postgres from 'postgres'

import { stagingDatabaseTarget } from '../lib/staging-validation'

for (const kind of ['school', 'identity'] as const) {
  const target = stagingDatabaseTarget(kind, process.env)
  const database = decodeURIComponent(target.pathname.slice(1))
  const role = decodeURIComponent(target.username)
  const sql = postgres(target.toString(), { max: 1 })
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
