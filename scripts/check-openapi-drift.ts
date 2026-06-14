#!/usr/bin/env bun
/**
 * Fails when generated OpenAPI artifacts drift from committed files.
 * Run after `openapi:generate` (or invoke via `bun run openapi:check`).
 */
import { $ } from 'bun'

const trackedPaths = [
  'apps/webapp/src/lib/api/openapi.json',
  'apps/webapp/src/lib/api/schema.d.ts',
  'packages/api-client/src/generated',
]

const diff = await $`git diff --name-only -- ${trackedPaths}`.quiet().nothrow()
if (diff.exitCode !== 0) {
  console.error('Failed to inspect OpenAPI artifact drift with git diff')
  process.exit(diff.exitCode)
}

const changed = diff.stdout.toString().trim()
if (changed.length > 0) {
  console.error('OpenAPI artifacts are out of date. Run `bun run openapi:generate` and commit the changes.')
  console.error('Changed files:')
  for (const line of changed.split('\n')) {
    console.error(`  - ${line}`)
  }
  process.exit(1)
}

console.log('OpenAPI artifacts are up to date.')
