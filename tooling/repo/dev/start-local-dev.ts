#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'

const repoRoot = resolve(import.meta.dirname, '../../..')
const apiRoot = resolve(repoRoot, 'apps/api')
const docsRoot = resolve(repoRoot, 'apps/docs')

function loadEnvFile(path: string): void {
  if (existsSync(path)) {
    dotenvExpand.expand(dotenv.config({ path }))
  }
}

loadEnvFile(resolve(apiRoot, '.env'))
loadEnvFile(resolve(docsRoot, '.env'))

const children = [
  Bun.spawn(['bun', '--filter', '@edaya/api', 'dev'], {
    cwd: repoRoot,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  }),
  Bun.spawn(['bun', '--filter', '@edaya/local-files-server', 'dev'], {
    cwd: repoRoot,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  }),
  Bun.spawn(['bun', '--filter', '@edaya/docs-api', 'start:local'], {
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
