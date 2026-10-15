import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import postgres from 'postgres'
import { loadLocalConfiguration } from '../../../../apps/api/configuration/index.ts'
import { assertStagingIdentityDatabaseUrl, isLocalAuthDatabaseUrl } from './lib/assert-identity-wipe-allowed'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
config({ path: resolve(repoRoot, '.env') })
loadLocalConfiguration(process.env)

const WIPE_AUTH_SQL = [
  'TRUNCATE TABLE identity.account CASCADE; TRUNCATE TABLE identity.challenge, identity.quota;',
  'TRUNCATE TABLE auth.verification, auth.edaya_auth_rate_buckets, auth."user" CASCADE;',
].join(' ')

type WipeTarget = 'local' | 'staging'

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

function parseArgs(argv: string[]): { target: WipeTarget, yes: boolean } {
  const args = argv.slice(2)
  const [target, ...flags] = args
  if ((target !== 'local' && target !== 'staging') || flags.length > 1 || flags.some(flag => !['--yes', '-y'].includes(flag)))
    throw new Error('Usage: bun repo ops db wipe identity <local|staging> [--yes]')

  return {
    target,
    yes: args.includes('--yes') || args.includes('-y'),
  }
}

function resolvePgliteDir(databaseUrl: string): string {
  const raw = databaseUrl.slice('pglite:'.length).trim() || '.data/identity'
  return isAbsolute(raw) ? raw : resolve(repoRoot, raw)
}

async function probeIdentityReachable(baseUrl: string): Promise<boolean> {
  const normalized = baseUrl.replace(/\/+$/, '')
  try {
    const response = await fetch(`${normalized}/`, {
      signal: AbortSignal.timeout(2_000),
    })
    return response.status < 500
  }
  catch {
    return false
  }
}

async function wipeLocal(): Promise<void> {
  const databaseUrl = process.env['AUTH_DATABASE_URL'] ?? 'pglite:.data/identity'
  if (!isLocalAuthDatabaseUrl(databaseUrl)) {
    throw new Error('Local wipe expects AUTH_DATABASE_URL=pglite:.data/identity. Use `bun repo ops db wipe identity staging` for Neon.')
  }

  const identityUrl = process.env['API_ORIGIN'] ?? `http://localhost:${process.env['PORT'] ?? '9999'}`
  if (await probeIdentityReachable(identityUrl)) {
    throw new Error(
      `Identity is running at ${identityUrl}. Stop \`bun repo dev\` before wiping .data/identity — `
      + 'deleting the database while the process is up corrupts PGlite.',
    )
  }

  const dataDir = databaseUrl.startsWith('pglite:')
    ? resolvePgliteDir(databaseUrl)
    : resolve(repoRoot, '.data/identity')

  if (!existsSync(dataDir)) {
    console.log(`No ${dataDir} directory found (already clean).`)
    return
  }

  await rm(dataDir, { recursive: true, force: true })
  console.log(`Removed ${dataDir}`)
}

async function wipeStaging(): Promise<void> {
  const databaseUrl = process.env['STAGING_AUTH_DATABASE_URL'] ?? process.env['AUTH_DATABASE_URL']
  if (!databaseUrl?.trim()) {
    throw new Error('Set STAGING_AUTH_DATABASE_URL (or AUTH_DATABASE_URL) to the identity Neon staging connection string.')
  }

  assertStagingIdentityDatabaseUrl(databaseUrl)

  const sql = postgres(databaseUrl, { max: 1 })
  try {
    const rows = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'user'
      ) AS exists
    `
    if (!rows[0]?.exists) {
      throw new Error('Refusing to wipe: the target database has no auth.user table (not an identity database).')
    }

    await sql.unsafe(WIPE_AUTH_SQL)
  }
  finally {
    await sql.end({ timeout: 5 })
  }

  console.log('Staging Accounts and provider credentials wiped; Edaya signing keys kept.')
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv)
  const confirmed = await confirm(
    options.target === 'local'
      ? 'Delete local identity PGlite under .data/identity?'
      : 'Delete all Accounts and authentication data in staging identity (identity + auth schemas)?',
    options.yes,
  )
  if (!confirmed) {
    console.log('Cleanup cancelled.')
    return
  }

  if (options.target === 'local') {
    await wipeLocal()
    console.log('Local identity cleanup complete. Restart `bun dev` in edaya_backend.')
    return
  }

  await wipeStaging()
  console.log('Staging identity cleanup complete. Re-run school `bun repo ops seed staging` after identity is reachable.')
}

try {
  await main()
}
catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
