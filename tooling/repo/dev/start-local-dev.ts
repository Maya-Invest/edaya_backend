#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'

const repoRoot = resolve(import.meta.dirname, '../../..')
const apiRoot = resolve(repoRoot, 'apps/api')
const docsRoot = resolve(repoRoot, 'apps/docs')

/** Load a `.env` file without mutating `process.env`; drop blank values. */
function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {}
  }
  const isolated: Record<string, string | undefined> = { ...process.env }
  const result = dotenv.config({ path, processEnv: isolated })
  dotenvExpand.expand({ ...result, processEnv: isolated })
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(isolated)) {
    // Only keep keys that came from the file (or were newly set), not the full process.env clone.
    if (!(key in (result.parsed ?? {}))) {
      continue
    }
    if (value !== undefined && value.trim() !== '') {
      out[key] = value
    }
  }
  return out
}

const apiEnvFile = loadEnvFile(resolve(apiRoot, '.env'))
const docsEnvFile = loadEnvFile(resolve(docsRoot, '.env'))

function envFor(packageEnv: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...packageEnv,
  }
}

const docsPort = docsEnvFile.DOCS_PORT ?? '3090'

const children = [
  {
    name: '@edaya/api',
    url: 'http://localhost:9999',
    subprocess: Bun.spawn(['bun', '--filter', '@edaya/api', 'dev'], {
      cwd: repoRoot,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
      env: envFor(apiEnvFile),
    }),
  },
  {
    name: '@edaya/local-files-server',
    url: 'http://localhost:9200',
    subprocess: Bun.spawn(['bun', '--filter', '@edaya/local-files-server', 'dev'], {
      cwd: repoRoot,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
      env: envFor(apiEnvFile),
    }),
  },
  {
    name: '@edaya/docs-api',
    url: `http://localhost:${docsPort}`,
    subprocess: Bun.spawn(['bun', '--filter', '@edaya/docs-api', 'dev'], {
      cwd: repoRoot,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
      env: envFor(docsEnvFile),
    }),
  },
]

console.log('Local dev starting:')
for (const child of children) {
  console.log(`  - ${child.name}  ${child.url}`)
}
if (!existsSync(resolve(docsRoot, '.env'))) {
  console.warn(`  ! missing ${resolve(docsRoot, '.env')} — copy apps/docs/.env.example (JWT must match apps/api DOCS_JWT_SECRET)`)
}

function shutdown(signal?: NodeJS.Signals): void {
  for (const child of children) {
    try {
      child.subprocess.kill()
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

const exitCode = await Promise.race(children.map(child => child.subprocess.exited))
shutdown()
process.exit(exitCode)
