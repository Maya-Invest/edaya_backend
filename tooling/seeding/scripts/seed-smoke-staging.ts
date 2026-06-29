#!/usr/bin/env bun

import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { runSeedHttpCli } from './run-seed-http-cli.ts'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stagingEnvPath = path.join(packageRoot, '.env.staging')

if (existsSync(stagingEnvPath)) {
  expand(config({ path: stagingEnvPath }))
}

if (!process.env.SEED_API_URL?.trim()) {
  process.env.SEED_API_URL = process.env.STAGING_API_URL ?? 'https://api-staging.edaya.softilab.dev'
}

process.exit(await runSeedHttpCli(['bun', 'seed-smoke-staging', 'smoke']))
