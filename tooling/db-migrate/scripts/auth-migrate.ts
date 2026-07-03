#!/usr/bin/env bun
/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */

import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { applyAuthMigrations } from './lib/apply-auth-migrations'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(packageRoot, '../..')
const apiEnvPath = path.resolve(repoRoot, 'apps/api/.env')

if (existsSync(apiEnvPath)) {
  expand(config({ path: apiEnvPath }))
}

const databaseUrl = process.env['DATABASE_URL']

if (!databaseUrl || databaseUrl === 'memory') {
  console.error('Set DATABASE_URL in apps/api/.env before running auth-only migrations.')
  process.exit(1)
}

console.log('\n> Applying Better Auth migrations (auth schema only)')
await applyAuthMigrations(databaseUrl)
console.log('\nBetter Auth migrations applied.')
