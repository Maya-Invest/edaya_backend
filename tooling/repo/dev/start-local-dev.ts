#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'

const repoRoot = resolve(import.meta.dirname, '../../..')
const apiRoot = resolve(repoRoot, 'apps/api')

function loadApiEnv(): void {
  const envFile = resolve(apiRoot, '.env')
  if (existsSync(envFile)) {
    dotenvExpand.expand(dotenv.config({ path: envFile }))
  }
}

const identityProcessEnv = { ...process.env }
loadApiEnv()

console.log('Identity on :9900, school API on :9999, local files on :9200.')

const children = [
  Bun.spawn(['bun', '--filter', '@edaya/identity', 'dev'], {
    cwd: repoRoot,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: identityProcessEnv,
  }),
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
