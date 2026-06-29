#!/usr/bin/env bun

import process from 'node:process'
import { inferCleanupTargetFromEnv } from '../src/cleanup/infer-cleanup-target.ts'
import { runSeedCleanup } from '../src/cleanup/run-seed-cleanup.ts'
import { loadSeedEnvFiles } from '../src/load-seed-env.ts'
import { runSeedHttpCli } from './run-seed-http-cli.ts'

loadSeedEnvFiles()

if (!process.env.SEED_API_URL?.trim()) {
  console.error('seed:remote requires SEED_API_URL (remote API base URL).')
  console.error('Example: SEED_API_URL=https://api.example.com bun seed:remote')
  process.exit(1)
}

if (process.argv.includes('--clean')) {
  await runSeedCleanup({
    target: inferCleanupTargetFromEnv(),
    yes: true,
    school: true,
    auth: true,
  })
}

process.exit(await runSeedHttpCli(['bun', 'seed-remote', 'all']))
