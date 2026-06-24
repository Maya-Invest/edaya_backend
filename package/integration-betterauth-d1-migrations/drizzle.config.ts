import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'drizzle-kit'

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

const authPath = process.env.AUTH_DATABASE_PATH ?? '.data/auth.sqlite'

if (authPath === ':memory:') {
  throw new Error(
    'File-backed auth database required. Set AUTH_DATABASE_PATH=.data/auth.sqlite in apps/api/.env.',
  )
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  strict: true,
  dbCredentials: {
    url: resolveRepoLocalPath(authPath),
  },
})
