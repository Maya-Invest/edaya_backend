#!/usr/bin/env bun

import process from 'node:process'
import { waitForApi } from '../src/http/wait-for-api.ts'
import { resolveSeedHttpConfig, runSeedHttpCli } from './run-seed-http-cli.ts'

const { baseUrl } = resolveSeedHttpConfig()

console.log(`Waiting for API at ${baseUrl}...`)
await waitForApi(baseUrl)
console.log('API is ready. Running full HTTP seed...')

process.exit(await runSeedHttpCli(['bun', 'seed-init', 'all']))
