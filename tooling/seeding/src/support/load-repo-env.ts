import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { loadLocalConfiguration } from '../../../../apps/api/configuration/index.mjs'
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

/** Load seed CLI env: root `.env`, then `apps/api/config.local.jsonc` for school and identity URLs. */
export function loadSeedEnvFiles(repoRoot: string = resolveRepoRoot()): void {
  loadRepoEnvFile(repoRoot)
  loadLocalConfiguration(process.env, path.join(repoRoot, 'apps/api'))
}
