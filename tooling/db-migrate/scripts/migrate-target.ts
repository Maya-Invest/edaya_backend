#!/usr/bin/env bun

/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import type { MigrationScope, MigrationTarget } from './lib/resolve-migration-target'
import process from 'node:process'
import { applyNotifySchema } from './lib/apply-notify-schema'
import { applySchoolMigrations } from './lib/apply-school-migrations'
import {

  resolveMigrationTarget,
} from './lib/resolve-migration-target'

function parseTarget(value: string | undefined): MigrationTarget {
  if (value === 'local' || value === 'staging' || value === 'production') {
    return value
  }

  console.error('Usage: migrate-target.ts <local|staging|production> school')
  process.exit(1)
}

function parseScope(value: string | undefined): MigrationScope {
  if (value === 'school') {
    return 'school'
  }

  console.error('Usage: migrate-target.ts <local|staging|production> school')
  process.exit(1)
}

const target = parseTarget(process.argv[2])
parseScope(process.argv[3])
const resolved = resolveMigrationTarget(target)

process.env['DATABASE_URL'] = resolved.databaseUrl

console.log(`\n> Applying school migrations (${resolved.label})`)

if (target === 'production') {
  console.log('> Confirm the connection string targets the Neon branch you intend to migrate.')
}

await applySchoolMigrations(resolved.databaseUrl)
await applyNotifySchema(resolved.databaseUrl)

console.log('\nMigrations applied.')
