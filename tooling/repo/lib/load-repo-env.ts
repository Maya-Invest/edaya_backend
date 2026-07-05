import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

/** Monorepo root (`edaya_backend/`) from `tooling/repo/lib/`. */
export function resolveRepoRoot(fromModuleUrl: string = import.meta.url): string {
  const moduleDir = path.dirname(fileURLToPath(fromModuleUrl))
  return path.resolve(moduleDir, '../../..')
}

function loadEnvFile(envFile: string, override = false): void {
  if (existsSync(envFile)) {
    expand(config({ path: envFile, override }))
  }
}

/** Load repo root `.env` (legacy `tooling/seeding/.env` when root file is absent). */
export function loadRepoEnvFile(repoRoot: string): void {
  const rootEnv = path.join(repoRoot, '.env')
  const legacySeedingEnv = path.join(repoRoot, 'tooling/seeding/.env')

  if (existsSync(rootEnv)) {
    loadEnvFile(rootEnv)
    return
  }

  loadEnvFile(legacySeedingEnv)
}

/** Load seed CLI env: root `.env`, then `apps/api/.env` for BETTER_AUTH_URL fallbacks. */
export function loadSeedEnvFiles(repoRoot: string): void {
  loadRepoEnvFile(repoRoot)
  loadEnvFile(path.join(repoRoot, 'apps/api/.env'))
}
