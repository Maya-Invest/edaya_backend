#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import app from '../../../apps/api/src/app.ts'
import { resetApiRuntimesForTests } from '../../../apps/api/src/runtime/local/registry.ts'
import { loadLocalProcessEnv } from '../../../apps/api/src/runtime/shared/env/local-loader.ts'
import { resolveArgvPath, trackedOpenApiPath } from './paths.ts'

export async function exportOpenApi(outputPath = trackedOpenApiPath): Promise<void> {
  const env = loadLocalProcessEnv()
  const res = await app.request('/doc', undefined, env)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to fetch OpenAPI doc: ${res.status}\nBody: ${body}`)
  }
  const schema = await res.json()

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(schema, null, 2))
  await resetApiRuntimesForTests()
}

if (import.meta.main) {
  const outputPath = resolveArgvPath('--output', trackedOpenApiPath)

  exportOpenApi(outputPath)
    .then(() => {
      console.log(`OpenAPI schema successfully exported to ${outputPath}`)
    })
    .catch((err) => {
      console.error('Failed to export OpenAPI schema:', err)
      process.exit(1)
    })
}
