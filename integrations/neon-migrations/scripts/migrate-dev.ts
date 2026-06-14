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
const devVarsPath = path.resolve(repoRoot, 'apps/api/.dev.vars')

if (!existsSync(devVarsPath)) {
  console.error('Missing apps/api/.dev.vars. Copy from apps/api/.dev.vars.example first.')
  process.exit(1)
}

expand(config({ path: devVarsPath }))

const databaseUrl
  = process.env['CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE']
    ?? process.env['DATABASE_URL']

if (!databaseUrl || databaseUrl === 'pglite' || databaseUrl === 'memory') {
  console.error(
    'Set CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE or DATABASE_URL in apps/api/.dev.vars',
  )
  process.exit(1)
}

process.env['DATABASE_URL'] = databaseUrl

const scriptPath = path.resolve(packageRoot, 'scripts/migrate-all.ts')
const result = Bun.spawnSync(['bun', scriptPath], {
  cwd: repoRoot,
  env: process.env,
  stdio: ['inherit', 'inherit', 'inherit'],
})

process.exit(result.exitCode ?? 1)
