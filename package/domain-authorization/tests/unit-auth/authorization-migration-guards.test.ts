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
    return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : []
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

  test('domain entity business validation has no actor input', async () => {
    const sources = await readSourceUnder(schoolServiceRoot, ['src/services/entities/config'])
    const offenders = sources
      .filter(source => /\b(?:ActorMetadata|SchoolScopedActorMetadata|actor|_actor)\b/.test(source.text))
      .map(source => source.path)

    expect(offenders).toEqual([])
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

  test('runtime policies do not import administration presets', async () => {
    const sources = await readSourceUnder(authorizationRoot, ['src/access'])
    expect(sources.filter(source => /from ['"][^'"]*presets['"]/.test(source.text)).map(source => source.path)).toEqual([])
  })

  test('production callers use action-bound policies rather than assembling permission checks', async () => {
    const sources = [
      ...(await readSourceUnder(schoolServiceRoot, ['src'])),
      ...(await readSourceUnder(join(authorizationRoot, '../../apps/api'), ['src'])),
      ...(await readSourceUnder(join(authorizationRoot, '../../tooling/seeding'), ['src'])),
    ]
    const offenders = sources
      .filter(source => /\baccess\.(?:scope|assertResources|assertSchool|assertSave|assertIntegrationCaller)\s*\(/.test(source.text))
      .map(source => source.path)
    expect(offenders).toEqual([])
  })

  test('legacy authorization engine entry points stay removed from production source', async () => {
    const sources = [
      ...(await readSourceUnder(authorizationRoot, ['src'])),
      ...(await readSourceUnder(schoolServiceRoot, ['src'])),
      ...(await readSourceUnder(coreRoot, ['src'])),
      ...(await readSourceUnder(join(authorizationRoot, '../adaptor-postgres'), ['src'])),
      ...(await readSourceUnder(join(authorizationRoot, '../adaptor-notify'), ['src'])),
      ...(await readSourceUnder(join(authorizationRoot, '../../apps/api'), ['src'])),
      ...(await readSourceUnder(join(authorizationRoot, '../../tooling/seeding'), ['src'])),
    ]
    const forbiddenPatterns = [
      /\b(?:GRANTS_CACHE_TTL_MS|NOTIFICATION_PROVIDER|createNovuNotificationGateway|createNovuSubscriberClient|upsertSchoolRecipient|removeSchoolRecipient)\b/,
      /\b(?:scheduleNotificationRecipientUpsert|scheduleNotificationRecipientRemove|scheduleNotificationRecipientBackfillForActor)\b/,
      /\b(?:scopeIds|scopeGrants|sourceStaffAssignmentId|moduleChecked)\b/,
      /\b(?:TeacherCapability|GuardianCapability|StudentCapability|PlatformPermission)\b/,
      /\b(?:assertOperation|defineOperation|DefaultAuthorizationRepository|resolveActorScope|resolveActorGrants)\b/,
      /\b(?:syncStaffAssignmentPermissions|invalidateAuthCacheForEvents|resolveCachedEffectiveGrants)\b/,
      /\beffectiveGrants\s*:/,
      /\.(?:effectiveGrants|teacherScope|guardianScope|studentScope)\b/,
      /\bcheckGlobalAction\b/,
      /\b(?:serviceOnly|assertCommandActorKind)\b/,
      /\bAuthorizationAction\b/,
      /\blegacy-action-map\b/,
      /\bauthorization-engine\b/,
      /\bStaffMember\.roles\b/,
      /\bstaffMember\.roles\b/,
    ]
    const offenders = sources
      .filter(source => source.path !== 'src/lib/school-api/client-bindings.ts')
      .filter(source => forbiddenPatterns.some(pattern => pattern.test(source.text)))
      .map(source => source.path)

    expect(offenders).toEqual([])
  })
})
