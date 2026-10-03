#!/usr/bin/env bun
import { resolve } from 'node:path'
import { generateClientArtifacts, isOpenApiUrl } from '../codegen/src/index'
import {
  resolveArgvPath,
  trackedApiClientDirPath,
  trackedOpenApiPath,
} from './paths.ts'

export async function generateClientArtifactsFromOpenApi(
  openApiInput = trackedOpenApiPath,
): Promise<void> {
  await generateClientArtifacts({
    input: openApiInput,
    clientDir: trackedApiClientDirPath,
    schemaOut: resolve(trackedApiClientDirPath, 'schema.d.ts'),
  })
}

if (import.meta.main) {
  const openApiInput = resolveArgvPath('--openapi', trackedOpenApiPath)

  await generateClientArtifactsFromOpenApi(openApiInput)
  const sourceLabel = isOpenApiUrl(openApiInput) ? openApiInput : openApiInput
  console.log(`API client artifacts generated from ${sourceLabel}`)
}
