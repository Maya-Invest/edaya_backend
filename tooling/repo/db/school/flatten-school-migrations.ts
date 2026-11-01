#!/usr/bin/env bun
import { resolve } from 'node:path'
import process from 'node:process'
import { confirmOperation } from '../../cli/lib/confirm'
import { run } from '../../ops/runtime'
import { flattenMigrations } from './lib/flatten-migrations'

const args = process.argv.slice(2)
if (args.some(arg => !['--yes', '-y'].includes(arg)) || args.length > 1)
  throw new Error('Usage: bun repo ops db flatten [--yes]')
if (!await confirmOperation('Replace school migration history with one baseline? Existing files will be backed up.', args.length > 0))
  process.exit(0)
const packageRoot = resolve(import.meta.dirname, '../../../../package/adaptor-postgres')
const backup = await flattenMigrations(resolve(packageRoot, 'drizzle'), async (output) => {
  await run(['bun', 'x', '--bun', 'drizzle-kit', 'generate', '--dialect', 'postgresql', '--schema', './src/postgres-schema.ts', '--out', output], { cwd: packageRoot })
})
console.log(`School migrations flattened. Previous history retained at ${backup}. Review before committing; existing databases need a separate migration/reset strategy.`)
