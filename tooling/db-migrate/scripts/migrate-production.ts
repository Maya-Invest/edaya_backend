#!/usr/bin/env bun
/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */

import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(packageRoot, '../..')
const productionEnvPath = path.resolve(repoRoot, 'tooling/seeding/.env.production')

if (existsSync(productionEnvPath)) {
  expand(config({ path: productionEnvPath }))
}

const databaseUrl = process.env['PRODUCTION_DATABASE_URL'] ?? process.env['DATABASE_URL']

if (!databaseUrl || databaseUrl === 'pglite' || databaseUrl === 'memory') {
  console.error('Set PRODUCTION_DATABASE_URL (or DATABASE_URL) to the Neon production branch connection string.')
  console.error('Example: cp tooling/seeding/.env.production.example tooling/seeding/.env.production')
  console.error('         PRODUCTION_DATABASE_URL=postgres://… bun run db:migrate:production')
  process.exit(1)
}

process.env['DATABASE_URL'] = databaseUrl

console.log('\n> Applying school + auth migrations (production)')
console.log('> Confirm the connection string targets the Neon branch you intend to migrate.')

const scriptPath = path.resolve(packageRoot, 'scripts/migrate-full.ts')
const result = Bun.spawnSync(['bun', scriptPath], {
  cwd: packageRoot,
  env: process.env,
  stdio: ['inherit', 'inherit', 'inherit'],
})

process.exit(result.exitCode ?? 1)
