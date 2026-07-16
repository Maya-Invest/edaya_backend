#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import appRouter from '../../../apps/api/src/app-router.ts'
import { createRouter } from '../../../apps/api/src/http/create-app.ts'
import configureOpenAPI from '../../../apps/api/src/http/openapi.ts'
import { resolveArgvPath, trackedOpenApiPath } from './paths.ts'

export async function exportOpenApi(outputPath = trackedOpenApiPath): Promise<void> {
  const app = createRouter()
  configureOpenAPI(app)
  app.route('/', appRouter)

  const res = await app.request('/doc')
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to fetch OpenAPI doc: ${res.status}\nBody: ${body}`)
  }
  const schema = await res.json()

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(schema, null, 2))
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
