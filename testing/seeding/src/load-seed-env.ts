/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(packageRoot, '../..')

const DEFAULT_ENV_FILES = [
  path.join(packageRoot, '.env'),
  path.join(repoRoot, 'apps/api/.env'),
] as const

/** Load seed CLI env files into `process.env` (skipped when `NODE_ENV=production`). */
export function loadSeedEnvFiles(): void {
  if (process.env['NODE_ENV'] === 'production') {
    return
  }

  const explicit = process.env['SEED_ENV_FILE']?.trim()
  if (explicit) {
    expand(config({ path: path.resolve(explicit) }))
    return
  }

  for (const envFile of DEFAULT_ENV_FILES) {
    if (existsSync(envFile)) {
      expand(config({ path: envFile }))
    }
  }

  const seedTarget = process.env['SEED_API_URL'] ?? process.env['BETTER_AUTH_URL'] ?? 'http://localhost:9999'
  const stagingEnvFile = path.join(repoRoot, 'testing/seeding/.env.staging')
  if (seedTarget.includes('api-staging.') && existsSync(stagingEnvFile)) {
    expand(config({ path: stagingEnvFile }))
  }
}
