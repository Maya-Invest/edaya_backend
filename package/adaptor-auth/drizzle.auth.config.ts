import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl || databaseUrl === 'pglite' || databaseUrl === 'memory') {
  throw new Error(
    'Postgres DATABASE_URL required. Set DATABASE_URL=postgres://… or use pglite:.data/school for local generation.',
  )
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle/auth',
  dialect: 'postgresql',
  strict: true,
  dbCredentials: databaseUrl.startsWith('postgres') || databaseUrl.startsWith('pglite')
    ? { url: databaseUrl }
    : undefined,
  schemaFilter: ['auth'],
})
