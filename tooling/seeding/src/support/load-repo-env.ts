import { existsSync } from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { resolveRepoRoot } from './resolve-repo-root'

function loadEnvFile(envFile: string, override = false): void {
  if (existsSync(envFile)) {
    expand(config({ path: envFile, override }))
  }
}

/** Load repo root `.env` (legacy `tooling/seeding/.env` when root file is absent). */
export function loadRepoEnvFile(repoRoot: string = resolveRepoRoot()): void {
  const rootEnv = path.join(repoRoot, '.env')
  const legacySeedingEnv = path.join(repoRoot, 'tooling/seeding/.env')

  if (existsSync(rootEnv)) {
    loadEnvFile(rootEnv)
    return
  }

  loadEnvFile(legacySeedingEnv)
}

/** Load seed CLI env: root `.env`, then `apps/api/.env` for school and identity URLs. */
export function loadSeedEnvFiles(repoRoot: string = resolveRepoRoot()): void {
  loadRepoEnvFile(repoRoot)
  loadEnvFile(path.join(repoRoot, 'apps/api/.env'))
}
