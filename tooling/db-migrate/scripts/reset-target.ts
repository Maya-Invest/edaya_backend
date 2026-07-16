#!/usr/bin/env bun

import type { MigrationTarget } from './lib/resolve-migration-target'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { applyAuthMigrations } from './lib/apply-auth-migrations'
import { applySchoolMigrations } from './lib/apply-school-migrations'
import { assertRemoteResetAllowed } from './lib/assert-remote-reset-allowed'
import { resetRemoteDatabase } from './lib/reset-remote-database'
import { resolveMigrationTarget } from './lib/resolve-migration-target'

function parseTarget(value: string | undefined): Extract<MigrationTarget, 'staging' | 'production'> {
  if (value === 'staging' || value === 'production') {
    return value
  }

  console.error('Usage: reset-target.ts <staging|production> [--yes]')
  process.exit(1)
}

async function confirm(message: string, autoYes: boolean): Promise<boolean> {
  if (autoYes) {
    return true
  }

  if (!process.stdin.isTTY) {
    throw new Error(`${message} Re-run with --yes in non-interactive environments.`)
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question(`${message} [y/N] `)
    const normalized = answer.trim().toLowerCase()
    return normalized === 'y' || normalized === 'yes'
  }
  finally {
    rl.close()
  }
}

const target = parseTarget(process.argv[2])
const autoYes = process.argv.includes('--yes') || process.argv.includes('-y')
const resolved = resolveMigrationTarget(target)

assertRemoteResetAllowed(target, resolved.databaseUrl)

const confirmed = await confirm(
  `This will DROP drizzle, auth, and public schemas on ${resolved.label} and re-apply all migrations. Continue?`,
  autoYes,
)
if (!confirmed) {
  console.log('Reset cancelled.')
  process.exit(0)
}

console.log(`\n> Resetting ${resolved.label} database schemas`)
await resetRemoteDatabase(resolved.databaseUrl)

console.log('\n> Applying school schema migrations')
await applySchoolMigrations(resolved.databaseUrl)

console.log('\n> Applying Better Auth migrations')
await applyAuthMigrations(resolved.databaseUrl)

console.log(`\n${resolved.label} database reset complete.`)
if (target === 'staging') {
  console.log('Run `bun repo seed --staging` to load demo data.')
}
else {
  console.log('Production has no automated seed — provision data manually after reset.')
}
