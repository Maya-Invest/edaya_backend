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
const devVarsPath = path.resolve(repoRoot, 'apps/api/.dev.vars')

if (existsSync(productionEnvPath)) {
  expand(config({ path: productionEnvPath }))
}

if (!process.env['PRODUCTION_DATABASE_URL']?.trim() && existsSync(devVarsPath)) {
  expand(config({ path: devVarsPath, override: true }))
}

const databaseUrl
  = process.env['PRODUCTION_DATABASE_URL']
    ?? process.env['CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE']
    ?? process.env['DATABASE_URL']

if (!databaseUrl || databaseUrl === 'pglite' || databaseUrl === 'memory') {
  console.error(
    'Set PRODUCTION_DATABASE_URL in tooling/seeding/.env.production, '
    + 'or CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE / DATABASE_URL in apps/api/.dev.vars',
  )
  console.error('Preferred: cp tooling/seeding/.env.production.example tooling/seeding/.env.production')
  process.exit(1)
}

if (!existsSync(productionEnvPath) || !process.env['PRODUCTION_DATABASE_URL']?.trim()) {
  console.warn(
    '\n> db:migrate:hyperdrive is deprecated — prefer `bun run db:migrate:production` '
    + 'with tooling/seeding/.env.production\n',
  )
}

process.env['DATABASE_URL'] = databaseUrl

console.log('\n> Applying school + auth migrations (production / Hyperdrive origin)')
console.log('> Confirm the connection string targets the Neon branch you intend to migrate.')

const scriptPath = path.resolve(packageRoot, 'scripts/migrate-full.ts')
const result = Bun.spawnSync(['bun', scriptPath], {
  cwd: packageRoot,
  env: process.env,
  stdio: ['inherit', 'inherit', 'inherit'],
})

process.exit(result.exitCode ?? 1)
