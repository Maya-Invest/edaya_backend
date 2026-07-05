/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import path from 'node:path'
import process from 'node:process'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { loadSeedEnvFiles as loadRepoSeedEnvFiles } from '../../../repo/lib/load-repo-env'
import { resolveRepoRoot } from './resolve-repo-root'

const repoRoot = resolveRepoRoot()

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

  loadRepoSeedEnvFiles(repoRoot)
}
