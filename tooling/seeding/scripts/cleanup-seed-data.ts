#!/usr/bin/env bun

import process from 'node:process'
import { cleanupUsage, parseCleanupArgs } from '../src/cleanup/parse-cleanup-args'
import { runSeedCleanup } from '../src/cleanup/run-seed-cleanup'

console.warn('cleanup-seed-data.ts is deprecated — use: bun seed clean [--staging]')

try {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(cleanupUsage())
    process.exit(0)
  }

  const options = parseCleanupArgs(process.argv)
  await runSeedCleanup(options)
}
catch (error) {
  console.error(error instanceof Error ? error.message : error)
  console.error('')
  console.error(cleanupUsage())
  process.exit(1)
}
