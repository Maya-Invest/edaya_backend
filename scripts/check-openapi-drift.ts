#!/usr/bin/env bun
/**
 * Regenerates API artifacts in a temporary directory and compares them with
 * committed files without changing the working tree.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { $ } from 'bun'
import { findDriftedArtifacts } from './generated-artifacts'

const repoRoot = resolve(import.meta.dirname, '..')
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'edaya-generated-'))
const generatedOpenApi = join(temporaryDirectory, 'openapi.json')
const generatedSchema = join(temporaryDirectory, 'schema.d.ts')
const generatedClientBindings = join(temporaryDirectory, 'client-bindings.ts')

async function runGeneration(): Promise<void> {
  await $`bun run --cwd ${join(repoRoot, 'apps/api')} export-openapi --output ${generatedOpenApi}`
  await $`${join(repoRoot, 'apps/webapp/node_modules/.bin/openapi-typescript')} ${generatedOpenApi} -o ${generatedSchema}`
  await $`bun run --cwd ${join(repoRoot, 'apps/api')} generate-api-client --output ${generatedClientBindings}`
}

const artifacts = [
  {
    generated: generatedOpenApi,
    tracked: resolve(repoRoot, 'apps/webapp/src/lib/api/openapi.json'),
  },
  {
    generated: generatedSchema,
    tracked: resolve(repoRoot, 'apps/webapp/src/lib/api/schema.d.ts'),
  },
  {
    generated: generatedClientBindings,
    tracked: resolve(repoRoot, 'packages/api-client/src/generated/client-bindings.ts'),
  },
]

try {
  await runGeneration()
  const changed = findDriftedArtifacts(artifacts, repoRoot)
  if (changed.length > 0) {
    console.error('Generated API artifacts are out of date. Run `bun run generated:update` and commit the changes.')
    console.error('Changed files:')
    for (const path of changed) {
      console.error(`  - ${path}`)
    }
    process.exitCode = 1
  }
  else {
    console.log('Generated API artifacts are up to date.')
  }
}
finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
