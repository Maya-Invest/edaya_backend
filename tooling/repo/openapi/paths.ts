import { resolve } from 'node:path'
import process from 'node:process'

export const repoRoot = resolve(import.meta.dirname, '../../..')

export const trackedOpenApiPath = resolve(repoRoot, 'apps/webapp/src/lib/api/openapi.json')
export const trackedSchemaPath = resolve(repoRoot, 'apps/webapp/src/lib/api/schema.d.ts')
export const trackedClientBindingsPath = resolve(
  repoRoot,
  'package/generated-api-client/src/generated/client-bindings.ts',
)

export function resolveArgvPath(flag: string, defaultPath: string): string {
  const flagIndex = process.argv.indexOf(flag)
  if (flagIndex === -1) {
    return defaultPath
  }

  const requestedPath = process.argv[flagIndex + 1]
  if (!requestedPath) {
    throw new Error(`${flag} requires a file path`)
  }
  return resolve(process.cwd(), requestedPath)
}
