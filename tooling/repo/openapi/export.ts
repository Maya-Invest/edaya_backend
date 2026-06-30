#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import {
  CLIENT_BINDINGS_OPENAPI_EXTENSION,
} from '@edaya/api-client/openapi-bindings'
import app from '../../../apps/api/src/app.ts'
import { buildClientBindings } from '../../../apps/api/src/lib/school-api/client-bindings.ts'
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
  const schema = await res.json() as {
    info?: Record<string, unknown>
  }

  schema.info = {
    ...schema.info,
    [CLIENT_BINDINGS_OPENAPI_EXTENSION]: buildClientBindings(),
  }

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
