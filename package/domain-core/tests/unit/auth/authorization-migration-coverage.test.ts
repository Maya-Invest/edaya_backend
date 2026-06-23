import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return sourceFiles(path)
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : []
  }))
  return files.flat()
}

async function readSourceUnder(paths: readonly string[]): Promise<Array<{ path: string, text: string }>> {
  const files = (await Promise.all(paths.map(path => sourceFiles(join(root, path))))).flat()
  return Promise.all(files.map(async path => ({
    path: relative(root, path),
    text: await readFile(path, 'utf8'),
  })))
}

function authorizationConfigSource(source: { path: string, text: string }): string {
  if (!source.path.startsWith('src/domains/'))
    return source.text

  const configStart = source.text.search(/^export const \w+Config\b/m)
  return configStart === -1 ? '' : source.text.slice(configStart)
}

describe('authorization migration coverage', () => {
  test('entity configs and workflows do not reintroduce legacy action strings', async () => {
    const sources = await readSourceUnder([
      'src/domains',
      'src/services/service-workflows',
      'src/shared/entity',
    ])
    const legacyActionPattern = /['"`][a-z]+(?:_[a-z]+)*\.[a-z_]+['"`]/
    const offenders = sources
      .filter(source => legacyActionPattern.test(authorizationConfigSource(source)))
      .map(source => source.path)

    expect(offenders).toEqual([])
  })

  test('entity config authorization uses Permission enum values, not raw strings', async () => {
    const sources = await readSourceUnder(['src/domains'])
    const rawPermissionPattern = /\b(?:permissionAction|anyPermissionAction)\s*\([^,\n]*,\s*(?:\[[^\]\n]*['"`][A-Z][A-Z0-9_]+['"`]|['"`][A-Z][A-Z0-9_]+['"`])/
    const offenders = sources
      .filter(source => authorizationConfigSource(source).split('\n').some(line => rawPermissionPattern.test(line)))
      .map(source => source.path)

    expect(offenders).toEqual([])
  })

  test('legacy authorization engine entry points stay removed from production source', async () => {
    const sources = await readSourceUnder(['src'])
    const forbiddenPatterns = [
      /\bcheckGlobalAction\b/,
      /\bAuthorizationAction\b/,
      /\blegacy-action-map\b/,
      /\bauthorization-engine\b/,
      /\bStaffMember\.roles\b/,
      /\bstaffMember\.roles\b/,
    ]
    const offenders = sources
      .filter(source => forbiddenPatterns.some(pattern => pattern.test(source.text)))
      .map(source => source.path)

    expect(offenders).toEqual([])
  })
})
