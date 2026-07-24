import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import openapiTS, { astToString } from 'openapi-typescript'
import { exportOpenApi } from './export.ts'
import {
  docsClientOpenApiPath,
  docsClientSchemaPath,
  docsClientSrc,
  trackedOpenApiPath,
} from './paths.ts'

export async function generateDocsClient(): Promise<void> {
  await exportOpenApi(trackedOpenApiPath)
  mkdirSync(docsClientSrc, { recursive: true })
  copyFileSync(trackedOpenApiPath, docsClientOpenApiPath)

  const ast = await openapiTS(new URL(`file://${trackedOpenApiPath}`))
  writeFileSync(docsClientSchemaPath, `${astToString(ast)}\n`)
}

if (import.meta.main)
  await generateDocsClient()
