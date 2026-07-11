import { resolve } from 'node:path'
import process from 'node:process'

export const repoRoot = resolve(import.meta.dirname, '../../..')

export const trackedOpenApiPath = resolve(repoRoot, 'tooling/repo/fixtures/openapi.json')
export const trackedApiClientDirPath = resolve(
  repoRoot,
  'edaya-client-codegen/clients/school-api/src',
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
