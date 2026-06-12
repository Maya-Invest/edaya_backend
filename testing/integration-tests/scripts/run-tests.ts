#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const result = spawnSync(
  process.execPath,
  [
    'test',
    '--parallel=1',
    '--max-concurrency=1',
    ...process.argv.slice(2),
  ],
  {
    cwd: packageRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      INTEGRATION_TEST_INCLUDE_REMOTE: '1',
    },
  },
)

process.exit(result.status ?? 1)
