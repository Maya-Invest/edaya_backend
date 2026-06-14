#!/usr/bin/env bun

import { runSmokeStagingCli } from '../src/run-smoke-staging'

process.exit(await runSmokeStagingCli())
