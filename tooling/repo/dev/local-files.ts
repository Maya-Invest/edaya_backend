#!/usr/bin/env bun

/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import {
  createLocalFileStorageApp,
  DEFAULT_LOCAL_FILES_ROOT,
  resolveLocalFileStorageConfig,
} from '@edaya/adaptor-local-fs'
import { loadLocalConfiguration } from '../../../apps/api/configuration/index.ts'

const repoRoot = resolve(import.meta.dirname, '../../..')
loadLocalConfiguration(process.env)

function resolveRootDir(value: string | undefined): string {
  const root = value ?? DEFAULT_LOCAL_FILES_ROOT
  if (root.startsWith('/') || /^[a-z]:[\\/]/i.test(root)) {
    return root
  }
  return resolve(repoRoot, root)
}

const port = Number(process.env['LOCAL_FILES_PORT'] ?? '9200')
const config = resolveLocalFileStorageConfig({
  LOCAL_FILES_URL: process.env['LOCAL_FILES_URL'] ?? `http://localhost:${port}`,
  LOCAL_FILES_ROOT: resolveRootDir(process.env['LOCAL_FILES_ROOT']),
  LOCAL_FILES_SECRET: process.env['LOCAL_FILES_SECRET'],
  TRUSTED_ORIGINS: process.env['TRUSTED_ORIGINS'],
})
const app = createLocalFileStorageApp(config)

console.log('Local file storage')
console.log(`  url:    ${config.baseUrl}`)
console.log(`  root:   ${config.rootDir}`)
console.log(`  port:   ${port}`)
console.log(`  cors:   ${(config.allowedOrigins ?? []).join(', ') || '*'}`)

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  fetch: app.fetch,
})

if (process.env['NODE_ENV'] === 'test' && process.env['EDAYA_FIXTURE_READY_FILE'] && process.env['EDAYA_FIXTURE_READY_TOKEN'])
  writeFileSync(process.env['EDAYA_FIXTURE_READY_FILE'], JSON.stringify({ pid: process.pid, token: process.env['EDAYA_FIXTURE_READY_TOKEN'] }), { mode: 0o600 })

process.on('SIGINT', () => {
  server.stop()
  process.exit(0)
})
