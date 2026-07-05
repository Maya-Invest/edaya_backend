/* eslint-disable no-console -- CLI progress output */
/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import type { CleanupOptions } from './parse-cleanup-args'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { loadSeedEnvFiles } from '../support/load-seed-env'
import { resolveRepoRoot } from '../support/resolve-repo-root'
import { probeLocalApiReachable } from './probe-local-api'
import { wipeLocalData } from './wipe-local-data'
import { wipeStagingAuthDatabase } from './wipe-staging-auth-db'
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

export async function runSeedCleanup(options: CleanupOptions): Promise<void> {
  loadSeedEnvFiles()
  const repoRoot = resolveRepoRoot(import.meta.url)

  if (options.target === 'local') {
    if (!options.school && !options.auth) {
      throw new Error('Nothing to wipe: enable school and/or auth cleanup.')
    }

    const apiUrl = process.env['SEED_API_URL']
      ?? process.env['BETTER_AUTH_URL']
      ?? 'http://localhost:9999'

    if (await probeLocalApiReachable(apiUrl)) {
      throw new Error(
        `Local API is running at ${apiUrl}. Stop \`bun dev\` before wiping .data — `
        + 'deleting databases while the API is up corrupts PGlite.',
      )
    }

    const confirmed = await confirm(
      'Delete local dev databases under .data/ (school PGlite, including auth schema)?',
      options.yes,
    )
    if (!confirmed) {
      console.log('Cleanup cancelled.')
      return
    }

    const result = await wipeLocalData({ repoRoot })
    if (result.removed) {
      console.log(`Removed ${result.dataDir}`)
    }
    else {
      console.log(`No ${result.dataDir} directory found (already clean).`)
    }

    console.log('Local cleanup complete. Restart `bun dev`, then run `bun seed`.')
    return
  }

  const actions: string[] = []
  if (options.school) {
    actions.push('truncate Neon staging public tables')
  }
  if (options.auth) {
    actions.push('delete Better Auth users in staging Neon auth schema')
  }

  const confirmed = await confirm(
    `This will ${actions.join(' and ')}. Continue?`,
    options.yes,
  )
  if (!confirmed) {
    console.log('Cleanup cancelled.')
    return
  }

  if (options.school) {
    const databaseUrl = resolveStagingDatabaseUrl()
    const result = await wipeStagingSchoolDatabase(databaseUrl)
    console.log(`Staging school database wiped (${result.tableCount} public tables truncated).`)
  }

  if (options.auth) {
    await wipeStagingAuthDatabase()
    console.log('Staging Better Auth tables wiped (auth.user/session/account/verification).')
  }

  console.log('Staging cleanup complete. Run `bun run db:migrate:staging` if needed, then `bun seed --staging`.')
}
