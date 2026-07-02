/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { resolveRepoRoot, resolveSeedingPackageRoot } from './resolve-repo-root'

const packageRoot = resolveSeedingPackageRoot()
const repoRoot = resolveRepoRoot()

const DEFAULT_ENV_FILES = [
  path.join(packageRoot, '.env'),
  path.join(repoRoot, 'apps/api/.env'),
] as const

function loadEnvFile(envFile: string, override = false): void {
  if (existsSync(envFile)) {
    expand(config({ path: envFile, override }))
  }
}

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
    loadEnvFile(envFile)
  }
}

/** Staging-only overrides — call from `seed:remote`, staging cleanup, etc. */
export function loadStagingSeedEnvFiles(): void {
  loadEnvFile(path.join(packageRoot, '.env.staging'), true)
}
