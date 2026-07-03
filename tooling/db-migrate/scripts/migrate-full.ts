#!/usr/bin/env bun
/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { applyAuthMigrations } from './lib/apply-auth-migrations'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const databaseUrl = process.env['DATABASE_URL']

if (!databaseUrl || databaseUrl === 'pglite' || databaseUrl === 'memory') {
  console.error('Set DATABASE_URL to a Postgres connection string before running migrations.')
  process.exit(1)
}

function runSchoolMigrations() {
  console.log('\n> Applying school schema migrations')
  const result = spawnSync('bun', ['run', 'migrate'], {
    cwd: packageRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

runSchoolMigrations()

console.log('\n> Applying Better Auth migrations')
await applyAuthMigrations(databaseUrl)
console.log('\nSchool and auth migrations applied.')
