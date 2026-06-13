import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.DATABASE_URL

export default defineConfig({
  schema: '../../packages/adaptor-postgres/src/postgres-schema.ts',
  out: '../../packages/adaptor-postgres/drizzle',
  dialect: 'postgresql',
  strict: true,
  dbCredentials: databaseUrl?.startsWith('postgres')
    ? { url: databaseUrl }
    : undefined,
})
