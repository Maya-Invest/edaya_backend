import { resolve } from 'node:path'
import process from 'node:process'

export const repoRoot = resolve(import.meta.dirname, '../../..')

export const trackedOpenApiPath = resolve(repoRoot, 'tooling/repo/fixtures/openapi.json')
export const trackedSeedingClientDirPath = resolve(
  repoRoot,
  'tooling/seeding/src/generated/api-client',
)
export const trackedIntegrationTestsClientDirPath = resolve(
  repoRoot,
  'tooling/integration-tests/src/generated/api-client',
)

export const trackedConsumerClientDirPaths = [
  trackedSeedingClientDirPath,
  trackedIntegrationTestsClientDirPath,
] as const

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
