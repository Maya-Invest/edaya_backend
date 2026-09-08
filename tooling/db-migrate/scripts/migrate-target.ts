#!/usr/bin/env bun

/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import type { MigrationScope, MigrationTarget } from './lib/resolve-migration-target'
import process from 'node:process'
import { applyAuthMigrations } from './lib/apply-auth-migrations'
import { applyNotifySchema } from './lib/apply-notify-schema'
import { applySchoolMigrations } from './lib/apply-school-migrations'
import {

  resolveMigrationTarget,
} from './lib/resolve-migration-target'

function parseTarget(value: string | undefined): MigrationTarget {
  if (value === 'local' || value === 'staging' || value === 'production') {
    return value
  }

  console.error('Usage: migrate-target.ts <local|staging|production> <full|school|auth>')
  process.exit(1)
}

function parseScope(value: string | undefined): MigrationScope {
  if (value === 'full' || value === 'school' || value === 'auth') {
    return value
  }

  console.error('Usage: migrate-target.ts <local|staging|production> <full|school|auth>')
  process.exit(1)
}

const target = parseTarget(process.argv[2])
const scope = parseScope(process.argv[3])
const resolved = resolveMigrationTarget(target)

process.env['DATABASE_URL'] = resolved.databaseUrl

const scopeLabel = scope === 'full'
  ? 'school + auth'
  : scope === 'school'
    ? 'school'
    : 'auth'

console.log(`\n> Applying ${scopeLabel} migrations (${resolved.label})`)

if (target === 'production' && scope !== 'auth') {
  console.log('> Confirm the connection string targets the Neon branch you intend to migrate.')
}

if (scope === 'school' || scope === 'full') {
  await applySchoolMigrations(resolved.databaseUrl)
  await applyNotifySchema(resolved.databaseUrl)
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
