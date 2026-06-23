import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.DATABASE_URL

export default defineConfig({
  schema: '../adaptor-postgres/src/postgres-schema.ts',
  out: '../adaptor-postgres/drizzle',
  dialect: 'postgresql',
  strict: true,
  dbCredentials: databaseUrl?.startsWith('postgres')
    ? { url: databaseUrl }
    : undefined,
})
