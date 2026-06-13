#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(packageRoot, '../..')
const apiWrangler = path.resolve(repoRoot, 'apps/api/wrangler.toml')

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

run('Applying Better Auth D1 migrations (local)', 'bunx', [
  'wrangler',
  'd1',
  'migrations',
  'apply',
  'edaya-auth',
  '--local',
  '--config',
  apiWrangler,
])

console.log('\nBetter Auth D1 migrations applied locally.')
