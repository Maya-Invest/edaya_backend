#!/usr/bin/env bun
/**
 * Regenerates API artifacts in a temporary directory and compares them with
 * committed files without changing the working tree.
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { checkClientArtifacts } from '../codegen/src/index'
import { exportOpenApi } from './export.ts'
import {
  repoRoot,
  trackedApiClientDirPath,
  trackedOpenApiPath,
} from './paths.ts'

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'edaya-generated-'))
const generatedOpenApi = join(temporaryDirectory, 'openapi.json')

try {
  await exportOpenApi(generatedOpenApi)
  const changed = await checkClientArtifacts({
    input: generatedOpenApi,
    openApiOut: trackedOpenApiPath,
    clientDir: existsSync(trackedApiClientDirPath) ? trackedApiClientDirPath : undefined,
    repoRoot,
  })

  if (changed.length > 0) {
    console.error('Generated API artifacts differ from the server:')
    for (const path of changed)
      console.error(`  ${path}`)
    process.exitCode = 1
  }
  else {
    console.log('Generated API artifacts are up to date.')
  }
}
finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
