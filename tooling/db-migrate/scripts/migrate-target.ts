#!/usr/bin/env bun

import process from 'node:process'
import { applyAuthMigrations } from './lib/apply-auth-migrations'
import { applySchoolMigrations } from './lib/apply-school-migrations'
import {
  type MigrationScope,
  type MigrationTarget,
  resolveMigrationTarget,
} from './lib/resolve-migration-target'

function parseTarget(value: string | undefined): MigrationTarget {
  if (value === 'local' || value === 'staging' || value === 'production') {
    return value
  }

  console.error('Usage: migrate-target.ts <local|staging|production> <full|pg|auth>')
  process.exit(1)
}

function parseScope(value: string | undefined): MigrationScope {
  if (value === 'full' || value === 'pg' || value === 'auth') {
    return value
  }

  console.error('Usage: migrate-target.ts <local|staging|production> <full|pg|auth>')
  process.exit(1)
}

const target = parseTarget(process.argv[2])
const scope = parseScope(process.argv[3])
const resolved = resolveMigrationTarget(target)

process.env['DATABASE_URL'] = resolved.databaseUrl

const scopeLabel = scope === 'full'
  ? 'school + auth'
  : scope === 'pg'
    ? 'school'
    : 'auth'

console.log(`\n> Applying ${scopeLabel} migrations (${resolved.label})`)

if (target === 'production' && scope !== 'auth') {
  console.log('> Confirm the connection string targets the Neon branch you intend to migrate.')
}

if (scope === 'pg' || scope === 'full') {
  await applySchoolMigrations(resolved.databaseUrl)
}

if (scope === 'auth' || scope === 'full') {
  if (scope === 'full') {
    console.log('\n> Applying Better Auth migrations')
  }
  else {
    console.log('\n> Applying Better Auth migrations (auth schema only)')
  }
  await applyAuthMigrations(resolved.databaseUrl)
}

console.log('\nMigrations applied.')
