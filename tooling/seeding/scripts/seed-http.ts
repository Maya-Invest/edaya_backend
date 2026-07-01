#!/usr/bin/env bun

import process from 'node:process'
import { inferCleanupTargetFromEnv } from '../src/cleanup/infer-cleanup-target.ts'
import { runSeedCleanup } from '../src/cleanup/run-seed-cleanup.ts'
import { loadSeedEnvFiles } from '../src/support/load-seed-env.ts'
import { runSeedHttpCli } from './run-seed-http-cli.ts'

loadSeedEnvFiles()

if (process.argv.includes('--clean')) {
  await runSeedCleanup({
    target: inferCleanupTargetFromEnv(),
    yes: true,
    school: true,
    auth: true,
  })
}

process.exit(await runSeedHttpCli(process.argv))
