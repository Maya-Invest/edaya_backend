#!/usr/bin/env bun

import process from 'node:process'
import { loadSeedEnvFiles } from '../src/load-seed-env.ts'
import { runSeedHttpCli } from './run-seed-http-cli.ts'

loadSeedEnvFiles()

if (!process.env.SEED_API_URL?.trim()) {
  console.error('seed:remote requires SEED_API_URL (remote API base URL).')
  console.error('Example: SEED_API_URL=https://api.example.com bun seed:remote')
  process.exit(1)
}

process.exit(await runSeedHttpCli(['bun', 'seed-remote', 'all']))
