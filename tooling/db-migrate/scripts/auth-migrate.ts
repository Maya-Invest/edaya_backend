#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const target = process.argv[2]
const wranglerEnv = process.argv[3] ?? 'production'

if (target !== 'local' && target !== 'remote') {
  console.error('Usage: bun ./scripts/auth-migrate.ts <local|remote> [production|staging]')
  process.exit(1)
}

if (wranglerEnv !== 'production' && wranglerEnv !== 'staging') {
  console.error('Wrangler environment must be "production" or "staging".')
  process.exit(1)
}

const remoteDatabaseName = wranglerEnv === 'staging' ? 'edaya-auth-staging' : 'edaya'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(packageRoot, '../..')
const apiWrangler = path.resolve(repoRoot, 'apps/api/wrangler.jsonc')

function run(label: string, command: string, args: string[]) {
  console.log(`\n> ${label}`)
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const isRemote = target === 'remote'

run(
  isRemote
    ? `Applying Better Auth D1 migrations (remote, ${wranglerEnv})`
    : 'Applying Better Auth D1 migrations (local)',
  'bunx',
  [
    'wrangler',
    'd1',
    'migrations',
    'apply',
    remoteDatabaseName,
    ...(isRemote ? ['--remote', '--env', wranglerEnv] : ['--local']),
    '--config',
    apiWrangler,
  ],
)

console.log(`\nBetter Auth D1 migrations applied ${isRemote ? `remotely (${wranglerEnv})` : 'locally'}.`)
