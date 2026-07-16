#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const adaptorPostgresRoot = path.join(repoRoot, 'package/adaptor-postgres')
const drizzleDir = path.join(adaptorPostgresRoot, 'drizzle')

function removeExistingSchoolMigrations(): void {
  if (!existsSync(drizzleDir)) {
    throw new Error(`Missing migrations folder: ${drizzleDir}`)
  }

  for (const entry of readdirSync(drizzleDir)) {
    if (entry.endsWith('.sql')) {
      rmSync(path.join(drizzleDir, entry))
    }
  }

  rmSync(path.join(drizzleDir, 'meta'), { recursive: true, force: true })
}

removeExistingSchoolMigrations()

console.log('> Generating baseline school migration from postgres-schema.ts')
const result = spawnSync('bun', ['run', 'db:generate'], {
  cwd: adaptorPostgresRoot,
  stdio: 'inherit',
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const sqlFiles = readdirSync(drizzleDir).filter(name => name.endsWith('.sql'))
if (sqlFiles.length !== 1) {
  console.error(`Expected exactly one baseline migration, found: ${sqlFiles.join(', ') || '(none)'}`)
  process.exit(1)
}

console.log(`\nSchool migrations flattened to ${sqlFiles[0]}.`)
console.log('Next steps:')
console.log('  bun repo db reset staging --yes')
console.log('  bun repo seed --staging')
console.log('  bun repo db reset production --yes')
