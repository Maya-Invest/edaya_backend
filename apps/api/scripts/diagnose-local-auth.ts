/**
 * Run with API stopped: bun scripts/diagnose-local-auth.ts
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runMigrations as runAuthMigrations } from '@edaya/adaptor-auth'
import { resolvePersistedPgliteDataDir } from '@edaya/adaptor-postgres'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { createBetterAuth } from '../src/runtime/index.ts'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const dataDir = resolvePersistedPgliteDataDir('pglite:.data/school', { repoRoot })

if (!dataDir) {
  console.error('Could not resolve PGlite data directory')
  process.exit(1)
}

console.log('repoRoot:', repoRoot)
console.log('dataDir:', dataDir)

const pglite = new PGlite(dataDir)
const db = drizzle(pglite)

const tables = await pglite.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'auth' ORDER BY tablename`,
)
console.log('auth tables:', tables.rows.map(row => row.tablename))

if (!tables.rows.some(row => row.tablename === 'user')) {
  console.log('\nMissing auth.user — applying auth migrations...')
  await runAuthMigrations(db, { driver: 'pglite' })
  const after = await pglite.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'auth' ORDER BY tablename`,
  )
  console.log('auth tables after migrate:', after.rows.map(row => row.tablename))
}

const auth = createBetterAuth(db, {
  BETTER_AUTH_SECRET: 'dev-secret-change-in-production',
  BETTER_AUTH_URL: 'http://localhost:9999',
  LOG_LEVEL: 'silent',
  NODE_ENV: 'development',
  REQUIRE_EMAIL_VERIFICATION: false,
} as never)

const email = `diag-${Date.now()}@local.test`
const res = await auth.handler(new Request('http://localhost:9999/auth/sign-up/email', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email,
    password: 'DevPassword123!',
    name: 'Diag',
  }),
}))

console.log('\nsign-up status:', res.status)
console.log('sign-up body:', await res.text())

await pglite.close()
