import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exportOpenApi } from './export.ts'
import { trackedOpenApiPath } from './paths.ts'

function normalize(jsonText: string): string {
  return JSON.stringify(JSON.parse(jsonText), null, 2)
}

export async function checkOpenApiDrift(): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'edaya-docs-openapi-'))
  const tempPath = join(tempDir, 'openapi.json')
  try {
    await exportOpenApi(tempPath)
    const tracked = normalize(readFileSync(trackedOpenApiPath, 'utf8'))
    const current = normalize(readFileSync(tempPath, 'utf8'))
    if (tracked !== current) {
      throw new Error(
        'OpenAPI fixture is out of date. Run `bun run docs:openapi:generate` and commit the result.',
      )
    }
  }
  finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

if (import.meta.main)
  await checkOpenApiDrift()
