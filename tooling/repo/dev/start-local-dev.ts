#!/usr/bin/env bun
import { resolve } from 'node:path'
import process from 'node:process'
import { loadLocalConfiguration } from '../../../apps/api/configuration/index.mjs'

const repoRoot = resolve(import.meta.dirname, '../../..')
const apiRoot = resolve(repoRoot, 'apps/api')

loadLocalConfiguration(process.env, apiRoot)

console.log('API and authentication on :9999, local files on :9200.')

const children = [
  Bun.spawn(['bun', '--no-env-file', '--filter', '@edaya/api', 'dev'], {
    cwd: repoRoot,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  }),
  Bun.spawn(['bun', '--no-env-file', '--watch', 'tooling/repo/dev/local-files.ts'], {
    cwd: repoRoot,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  }),
]

function shutdown(signal?: NodeJS.Signals): void {
  for (const child of children) {
    try {
      child.kill()
    }
    catch {
      // child may already be gone
    }
  }
  if (signal) {
    process.kill(process.pid, signal)
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => shutdown(signal))
}

const exitCode = await Promise.race(children.map(child => child.exited))
shutdown()
process.exit(exitCode)
