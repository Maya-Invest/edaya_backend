/* eslint-disable no-console -- CLI progress output */
/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import type { CleanupOptions } from './parse-cleanup-args'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { loadSeedEnvFiles } from '../support/load-seed-env'
import { resolveRepoRoot } from '../support/resolve-repo-root'
import { IDENTITY_AUTH_WIPE_HINT } from './parse-cleanup-args'
import { probeLocalApiReachable } from './probe-local-api'
import { wipeLocalData } from './wipe-local-data'
import { wipeStagingSchoolDatabase } from './wipe-staging-school-db'

async function confirm(message: string, autoYes: boolean): Promise<boolean> {
  if (autoYes) {
    return true
  }

  if (!process.stdin.isTTY) {
    throw new Error(`${message} Re-run with --yes in non-interactive environments.`)
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question(`${message} [y/N] `)
    const normalized = answer.trim().toLowerCase()
    return normalized === 'y' || normalized === 'yes'
  }
  finally {
    rl.close()
  }
}

function resolveStagingDatabaseUrl(): string {
  const databaseUrl = process.env['STAGING_DATABASE_URL'] ?? process.env['DATABASE_URL']
  if (!databaseUrl?.trim()) {
    throw new Error(
      'Set STAGING_DATABASE_URL in repo root .env before wiping staging school data.',
    )
  }
  return databaseUrl.trim()
}

export async function runSeedCleanup(options: CleanupOptions): Promise<boolean> {
  loadSeedEnvFiles()
  const repoRoot = resolveRepoRoot(import.meta.url)

  if (options.target === 'local') {
    const apiUrl = process.env['SEED_API_URL']
      ?? 'http://localhost:9999'

    if (await probeLocalApiReachable(apiUrl)) {
      throw new Error(
        `Local API is running at ${apiUrl}. Stop \`bun repo dev\` before wiping .data/school — `
        + 'deleting databases while the API is up corrupts PGlite.',
      )
    }

    const confirmed = await confirm(
      'Delete local school PGlite under .data/school/?',
      options.yes,
    )
    if (!confirmed) {
      console.log('Cleanup cancelled.')
      return false
    }

    const result = await wipeLocalData({ repoRoot })
    if (result.removed) {
      console.log(`Removed ${result.dataDir}`)
    }
    else {
      console.log(`No ${result.dataDir} directory found (already clean).`)
    }

    console.log(`Local school cleanup complete. ${IDENTITY_AUTH_WIPE_HINT}`)
    console.log('Restart `bun repo dev`, then run `bun repo ops seed`.')
    return true
  }

  const confirmed = await confirm(
    'This will truncate Neon staging public tables. Continue?',
    options.yes,
  )
  if (!confirmed) {
    console.log('Cleanup cancelled.')
    return false
  }

  const databaseUrl = resolveStagingDatabaseUrl()
  const result = await wipeStagingSchoolDatabase(databaseUrl)
  console.log(`Staging school database wiped (${result.tableCount} public tables truncated).`)
  console.log(IDENTITY_AUTH_WIPE_HINT)
  console.log('Staging school cleanup complete. Run `bun repo ops db migrate school staging` if needed, then `bun repo ops seed staging`.')
  return true
}
