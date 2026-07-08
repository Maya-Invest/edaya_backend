import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'

const authorizationRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const schoolServiceRoot = join(authorizationRoot, '../domain-service')
const coreRoot = join(authorizationRoot, '../domain-core')

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

async function readSourceUnder(root: string, paths: readonly string[]): Promise<Array<{ path: string, text: string }>> {
  const files = (await Promise.all(paths.map(path => sourceFiles(join(root, path))))).flat()
  return Promise.all(files.map(async path => ({
    path: relative(root, path),
    text: await readFile(path, 'utf8'),
  })))
}

function authorizationConfigSource(source: { path: string, text: string }): string {
  if (!source.path.startsWith('src/services/entities/config/') && !source.path.startsWith('src/domain/'))
    return source.text

  const configStart = source.text.search(/^export const \w+Config\b/m)
  return configStart === -1 ? '' : source.text.slice(configStart)
}

describe('authorization migration guards', () => {
  test('entity configs and workflows do not reintroduce legacy action strings', async () => {
    const sources = await readSourceUnder(schoolServiceRoot, [
      'src/services/entities/config',
      'src/services/workflows',
      'src/services/entities/entity-config',
    ])
    const legacyActionPattern = /['"`][a-z]+(?:_[a-z]+)*\.[a-z_]+['"`]/
    const offenders = sources
      .filter(source => legacyActionPattern.test(authorizationConfigSource(source)))
      .map(source => source.path)

    expect(offenders).toEqual([])
  })

  // Allowlist removed in G5.7 — domain entity configs must not branch on actor.kind.

  test('domain entity configs do not branch on actor.kind', async () => {
    const sources = await readSourceUnder(schoolServiceRoot, ['src/services/entities/config'])
    const offenders = sources
      .filter(source => /actor\.kind\s*[=!]==/.test(authorizationConfigSource(source)))
      .map(source => source.path)

    expect(offenders).toEqual([])
  })

  test('entity-config authorization does not add new WriteModule or ReadModule helpers', async () => {
    const path = join(schoolServiceRoot, 'src/services/entities/entity-config/authorization.ts')
    const text = await readFile(path, 'utf8')
    const helperPattern = /export function \w+(?:Write|Read)Module\b/g
    const matches = [...text.matchAll(helperPattern)].map(match => match[0])
    const allowed = new Set<string>([])
    const unexpected = matches
      .map(match => match.replace('export function ', ''))
      .filter(name => !allowed.has(name))

    expect(unexpected).toEqual([])
  })

  test('entity configs and workflows do not use permissionAction', async () => {
    const sources = await readSourceUnder(schoolServiceRoot, [
      'src/services/entities/config',
      'src/services/workflows',
    ])
    const offenders = sources
      .filter(source => /\bpermissionAction\b/.test(authorizationConfigSource(source)))
      .map(source => source.path)

    expect(offenders).toEqual([])
  })

  test('legacy authorization engine entry points stay removed from production source', async () => {
    const sources = [
      ...(await readSourceUnder(authorizationRoot, ['src'])),
      ...(await readSourceUnder(schoolServiceRoot, ['src'])),
      ...(await readSourceUnder(coreRoot, ['src'])),
    ]
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
