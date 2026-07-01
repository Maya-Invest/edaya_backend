#!/usr/bin/env bun
/**
 * Regenerates API artifacts in a temporary directory and compares them with
 * committed files without changing the working tree.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { checkClientArtifacts } from '@edaya/client-codegen'
import { exportOpenApi } from './export.ts'
import {
  repoRoot,
  trackedConsumerClientDirPaths,
  trackedOpenApiPath,
} from './paths.ts'

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'edaya-generated-'))
const generatedOpenApi = join(temporaryDirectory, 'openapi.json')

async function checkClientDirDrift(
  input: string,
  clientDir: string,
  label: string,
): Promise<string[]> {
  const changed = await checkClientArtifacts({
    input,
    clientDir,
    repoRoot,
  })

  if (changed.length > 0) {
    console.error(`${label} client artifacts are out of date. Run \`bun run generate:client\` and commit the changes.`)
    console.error('Changed files:')
    for (const path of changed) {
      console.error(`  - ${path}`)
    }
  }

  return changed
}

try {
  await exportOpenApi(generatedOpenApi)
  const changed = [
    ...(await checkClientArtifacts({
      input: generatedOpenApi,
      openApiOut: trackedOpenApiPath,
      repoRoot,
    })),
    ...(await Promise.all(
      trackedConsumerClientDirPaths.map(clientDir => checkClientDirDrift(
        generatedOpenApi,
        clientDir,
        clientDir.includes('/seeding/') ? 'Seeding' : 'Integration tests',
      )),
    )).flat(),
  ]

  if (changed.length > 0) {
    process.exitCode = 1
  }
  else {
    console.log('Generated API artifacts are up to date.')
  }
}
finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
