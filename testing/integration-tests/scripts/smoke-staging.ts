#!/usr/bin/env bun

import { runSmokeStagingCli } from '../src/staging/run-smoke-staging'

process.exit(await runSmokeStagingCli())
