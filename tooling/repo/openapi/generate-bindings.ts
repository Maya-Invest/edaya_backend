#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateClientArtifacts, isOpenApiUrl } from '@edaya/client-codegen'
import {
  resolveArgvPath,
  trackedApiClientDirPath,
  trackedOpenApiPath,
} from './paths.ts'

export async function generateClientArtifactsFromOpenApi(
  openApiInput = trackedOpenApiPath,
): Promise<void> {
  if (!existsSync(trackedApiClientDirPath)) {
    console.warn(
      'Skipping @maya-invest/edaya-api-client regeneration — checkout not found at '
      + `${trackedApiClientDirPath}. Symlink or clone edaya-client-codegen into the backend repo root.`,
    )
    return
  }

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
