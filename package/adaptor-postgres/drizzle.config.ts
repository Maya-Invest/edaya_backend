import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'drizzle-kit'
import { isEphemeralDatabase, resolvePgliteDataDir } from './src/lib/database-url'

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(packageRoot, '../..')

function resolveRepoLocalPath(pathValue: string): string {
  if (path.isAbsolute(pathValue)) {
    return pathValue
  }
  if (pathValue === '.data' || pathValue.startsWith('.data/')) {
    return path.resolve(repoRoot, pathValue)
  }
  return path.resolve(process.cwd(), pathValue)
}

function buildSchoolDbConfig() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return {}
  }

  if (databaseUrl.startsWith('postgres')) {
    return { dbCredentials: { url: databaseUrl } }
  }

  if (isEphemeralDatabase(databaseUrl)) {
    throw new Error(
      'Persisted school database required. Set DATABASE_URL=pglite:.data/school in apps/api/.env.',
    )
  }

  const dataDir = resolvePgliteDataDir(databaseUrl)
  if (!dataDir) {
    return {}
  }

  return {
    driver: 'pglite' as const,
    dbCredentials: { url: resolveRepoLocalPath(dataDir) },
  }
}

const school = buildSchoolDbConfig()

export default defineConfig({
  schema: './src/postgres-schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  strict: true,
  migrations: {
    schema: 'drizzle',
    table: '__drizzle_migrations_school',
  },
  ...school,
})
