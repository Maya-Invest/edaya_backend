#!/usr/bin/env bun

/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import process from 'node:process'
import { runSeedCleanup } from '../src/cleanup/run-seed-cleanup.ts'
import { loadSeedEnvFiles } from '../src/support/load-seed-env.ts'
import { parseSeedCliArgs, seedCliUsage, seedInvocationTarget } from '../src/support/parse-seed-cli.ts'
import { resolveStagingSeedApiUrl } from '../src/support/resolve-seed-env.ts'
import { runSeedHttpCli } from './run-seed-http-cli.ts'

loadSeedEnvFiles()
// Root dotenv may contain deployment credentials; seed work never needs them.
for (const key of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_EMAIL'])
  delete process.env[key]

let invocation
try {
  invocation = parseSeedCliArgs(process.argv)
}
catch (error) {
  console.error(error instanceof Error ? error.message : error)
  console.error('')
  console.error(seedCliUsage())
  process.exit(1)
}

if (invocation.kind === 'help') {
  console.log(seedCliUsage())
  process.exit(0)
}

const target = seedInvocationTarget(invocation)
if (target === 'staging' && !process.env['SEED_STAGING_API_URL']?.trim()) {
  console.warn(
    `SEED_STAGING_API_URL is unset; defaulting to ${resolveStagingSeedApiUrl()}. `
    + 'Set it in repo root .env to override the default staging API URL.',
  )
}

if (invocation.kind === 'clean') {
  await runSeedCleanup({
    target: invocation.target,
    yes: invocation.yes,
  })
  process.exit(0)
}

if (invocation.clean) {
  if (!await runSeedCleanup({
    target: invocation.target,
    yes: invocation.yes ?? false,
  })) {
    process.exit(0)
  }
}

process.exit(await runSeedHttpCli(invocation))
