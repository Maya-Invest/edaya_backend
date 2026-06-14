#!/usr/bin/env bun

import process from 'node:process'
import { runSeedHttpCli } from './run-seed-http-cli.ts'

process.exit(await runSeedHttpCli(process.argv))
