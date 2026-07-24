import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createDocsApp } from '../../../apps/docs/src/composition.ts'
import { trackedOpenApiPath } from './paths.ts'

export async function exportOpenApi(outputPath = trackedOpenApiPath): Promise<object> {
  const app = createDocsApp({
    auth: { devToken: 'openapi-export-token' },
  })
  const response = await app.request('/doc')
  if (!response.ok)
    throw new Error(`OpenAPI export failed: ${response.status}`)

  const schema = await response.json() as object
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(schema, null, 2)}\n`)
  return schema
}

if (import.meta.main)
  await exportOpenApi()
