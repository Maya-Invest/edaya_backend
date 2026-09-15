import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'bun:test'

const configRoot = join(import.meta.dir, '../../../src/services/entities/config')

const indirectParentGateExceptions = new Set([
  'academics/subject-matter.ts',
  'scheduling/attendance.ts',
])

const directDeleteGateExceptions = new Set([
  'access/account-invitation.ts',
  'academics/subject.ts',
  'messaging/message-delivery.ts',
  'messaging/school-notification-templates.ts',
  'scheduling/calendar-event.ts',
  'scheduling/period-definition.ts',
  'school/attachment.ts',
  'school/grade-level.ts',
  'school/grade-scale.ts',
  'school/school.ts',
  'school/staff-permission-assignment.ts',
  'students/disciplinary-action.ts',
  'students/guardian-student-link.ts',
  'students/student-health-profile.ts',
  'students/student-note.ts',
  'students/student-photo-submission.ts',
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
  test('rejects authorization bypasses in entity configs', () => {
    const noopConfigs = listConfigSources()
      .filter(config => /noop(?:Save|Delete)Access/.test(config.source))
      .map(config => config.path)
      .sort()

    expect(noopConfigs).toEqual([])
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
