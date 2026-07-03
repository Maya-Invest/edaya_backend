#!/usr/bin/env bun
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'

const repoRoot = resolve(import.meta.dirname, '../../..')
const apiRoot = resolve(repoRoot, 'apps/api')

function loadApiEnv(): void {
  const envFile = resolve(apiRoot, '.env')
  const devVarsFile = resolve(apiRoot, '.dev.vars')
  if (existsSync(envFile)) {
    dotenvExpand.expand(dotenv.config({ path: envFile }))
  }
  if (existsSync(devVarsFile)) {
    dotenvExpand.expand(dotenv.config({ path: devVarsFile, override: true }))
  }
}

function forwardSignal(child: ReturnType<typeof spawn>, signal: NodeJS.Signals): void {
  child.kill(signal)
}

loadApiEnv()

const filters = ['@edaya/api', '@edaya/local-files']
const turboArgs = ['turbo', 'run', 'dev', ...filters.flatMap(filter => ['--filter', filter])]
const child = spawn('bunx', turboArgs, {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => forwardSignal(child, signal))
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
