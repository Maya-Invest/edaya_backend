#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

const databaseUrl = process.env['DATABASE_URL']

if (!databaseUrl || databaseUrl === 'pglite' || databaseUrl === 'memory') {
  console.error('Set DATABASE_URL to a Postgres connection string before running migrations.')
  process.exit(1)
}

function run(label: string, args: string[]) {
  console.log(`\n> ${label}`)
  const result = spawnSync('bun', args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('Applying school schema migrations', ['run', 'db:migrate'])
run('Applying Better Auth D1 migrations (local)', ['run', 'db:migrate:auth'])

console.log('\nSchool and auth migrations applied.')
