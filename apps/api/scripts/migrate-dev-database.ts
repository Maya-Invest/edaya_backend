#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(apiRoot, '../..')
const devVarsPath = path.resolve(apiRoot, '.dev.vars')

if (!existsSync(devVarsPath)) {
  console.error('Missing apps/api/.dev.vars. Copy from .dev.vars.example first.')
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

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
}

function run(label: string, args: string[]) {
  console.log(`\n> ${label}`)
  const result = spawnSync('bun', args, {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('Applying school schema migrations', ['run', 'db:migrate'])
run('Applying Better Auth migrations', ['run', 'db:migrate:auth'])

console.log('\nDatabase migrations applied.')
