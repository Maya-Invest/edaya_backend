import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'bun:test'

const configRoot = join(import.meta.dir, '../../../src/domain')

const noopAccessExceptions = new Set([
  'academics/class-subject-matter.ts',
  'academics/grade-level-subject-matter.ts',
  'academics/grade-level-subject.ts',
  'academics/subject-matter.ts',
  'assessments/report-card-definition-section.ts',
  'assessments/report-card-definition.ts',
  'messaging/announcement-target.ts',
  'messaging/message-delivery.ts',
  'school/academic-year.ts',
  'school/grade-scale.ts',
  'school/school.ts',
])

const indirectParentGateExceptions = new Set([
  'academics/subject-matter.ts',
])

const directDeleteGateExceptions = new Set([
  'access/account-invitation.ts',
  'messaging/message-delivery.ts',
  'messaging/school-notification-templates.ts',
  'school/grade-scale.ts',
  'school/school.ts',
])

interface ConfigSource {
  path: string
  source: string
}

function listConfigSources(directory = configRoot): ConfigSource[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory())
      return listConfigSources(entryPath)
    if (!entry.name.endsWith('.ts'))
      return []

    return [{
      path: relative(configRoot, entryPath).replaceAll('\\', '/'),
      source: readFileSync(entryPath, 'utf8'),
    }]
  })
}

describe('entity config linter', () => {
  test('keeps noop access usage behind explicit architectural exceptions', () => {
    const noopConfigs = listConfigSources()
      .filter(config => /noop(?:Save|Delete)Access/.test(config.source))
      .map(config => config.path)
      .sort()

    expect(noopConfigs).toEqual([...noopAccessExceptions].sort())
  })

  test('requires indirect tenant configs to declare parent save gates or explicit exceptions', () => {
    const missingParentGates = listConfigSources()
      .filter(config => /indirectTenant|LinkedTenant|Tenant\(/.test(config.source))
      .filter(config => !/directSchoolTenant|schoolEntityTenant/.test(config.source))
      .filter(config => !/preSave\s*:/.test(config.source))
      .map(config => config.path)
      .sort()

    expect(missingParentGates).toEqual([...indirectParentGateExceptions].sort())
  })

  test('requires direct school tenant configs to declare delete gates or explicit exceptions', () => {
    const missingDeleteGates = listConfigSources()
      .filter(config => /directSchoolTenant|schoolEntityTenant/.test(config.source))
      .filter(config => !/preDelete\s*:/.test(config.source))
      .map(config => config.path)
      .sort()

    expect(missingDeleteGates).toEqual([...directDeleteGateExceptions].sort())
  })
})
