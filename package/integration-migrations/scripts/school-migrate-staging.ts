#!/usr/bin/env bun
/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { repairDrizzleMigrationJournal } from './repair-drizzle-journal'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(packageRoot, '../..')
const stagingEnvPath = path.resolve(repoRoot, 'tooling/seeding/.env.staging')

if (existsSync(stagingEnvPath)) {
  expand(config({ path: stagingEnvPath }))
}

const databaseUrl = process.env['STAGING_DATABASE_URL'] ?? process.env['DATABASE_URL']

if (!databaseUrl || databaseUrl === 'pglite' || databaseUrl === 'memory') {
  console.error('Set STAGING_DATABASE_URL (or DATABASE_URL) to the Neon staging branch connection string.')
  console.error('Example: STAGING_DATABASE_URL=postgres://… bun run db:migrate:staging')
  process.exit(1)
}

process.env['DATABASE_URL'] = databaseUrl

await repairDrizzleMigrationJournal(databaseUrl)

const result = spawnSync('bun', ['run', 'db:migrate'], {
  cwd: repoRoot,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
