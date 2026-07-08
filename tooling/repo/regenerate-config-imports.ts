/**
 * Regenerate clean import headers for extracted entity config files.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dir, '../..')
const DOMAIN_ROOT = join(ROOT, 'package/domain-core/src/domain')
const CONFIG_ROOT = join(ROOT, 'package/domain-service/src/services/entities/config')

const ENTITY_CONFIG_SYMBOLS = [
  'config',
  'EntityConfigFactory',
  'read',
  'write',
  'readByIds',
  'authorizeExistingById',
  'authorizeDeleteByReadAccess',
  'authorizeClassGroupLinked',
  'authorizeClassGroupLinkedDelete',
  'noopReadAccess',
  'noopSaveAccess',
  'noopDeleteAccess',
  'anyOperationModule',
  'authorizeSaveWithOperation',
  'authorizeDeleteWithOperation',
  'operationModule',
  'resourceGate',
  'resourceGateForDelete',
  'resourceGateForSave',
] as const

const TENANT_SYMBOLS = [
  'directSchoolTenant',
  'indirectTenant',
  'classGroupLinkedTenant',
  'resolveClassSubjectSchoolId',
  'resolveActivitySessionSchoolId',
  'resolveLessonSessionSchoolId',
] as const

const HELPER_SYMBOLS = ['unique', 'dateTime'] as const
const MANAGED_TYPE_SYMBOLS = ['EntityTenantResolver', 'EntityWriteAuthorization', 'EntityReadAuthorization'] as const

const AUTH_VALUE_SYMBOLS = [
  'AccessControlOperations',
  'TeacherOperations',
  'SchoolStructureOperations',
  'WorkspaceOperations',
  'AcademicsOperations',
  'AssessmentOperations',
  'AttendanceOperations',
  'CommunicationsOperations',
  'DisciplineOperations',
  'EnrollmentOperations',
  'FinanceOperations',
  'GradeOperations',
  'GuardianOperations',
  'LogbookOperations',
  'ReportCardOperations',
  'ResourceOperations',
  'SchedulingOperations',
  'StudentHealthOperations',
  'StudentOperations',
  'AttachmentOperations',
  'denyResourceAccess',
  'Permission',
  'permissionDefinitions',
  'validateScopeIds',
  'resolveStaffAssignmentTarget',
  'validateStaffAssignmentPermissionSelection',
  'deleteSyncedStaffAssignmentPermissions',
  'syncStaffAssignmentPermissions',
  'AuthorizationError',
  'AuthorizationErrorCode',
  'actorHasSchoolWideGrant',
] as const

const AUTH_TYPE_SYMBOLS = ['AuthorizationPolicy', 'ActorMetadata', 'OperationRef'] as const

const CORE_VALUE_SYMBOLS = ['BusinessRuleViolationError', 'CoreEntityRepositories'] as const

function walkTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full))
    }
    else if (entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
      out.push(full)
    }
  }
  return out
}

function collectUsed(content: string, symbols: readonly string[]): string[] {
  return symbols.filter(s => new RegExp(`\\b${s}\\b`).test(content))
}

function collectEntityImports(body: string, domainFile: string): { values: string[], types: string[] } {
  const domain = readFileSync(domainFile, 'utf8')
  const values = new Set<string>()
  const types = new Set<string>()
  for (const match of domain.matchAll(/export class (\w+)/g)) {
    if (body.includes(match[1]!)) {
      values.add(match[1]!)
    }
  }
  for (const match of domain.matchAll(/export enum (\w+)/g)) {
    if (body.includes(match[1]!)) {
      values.add(match[1]!)
    }
  }
  for (const match of domain.matchAll(/export (?:async )?function (\w+)/g)) {
    if (body.includes(match[1]!)) {
      values.add(match[1]!)
    }
  }
  for (const match of domain.matchAll(/export type (\w+)/g)) {
    if (body.includes(match[1]!)) {
      types.add(match[1]!)
    }
  }
  return { values: [...values], types: [...types] }
}

function relImport(configFile: string, target: string, extraUp = 1): string {
  const depth = relative(CONFIG_ROOT, configFile).split('/').length - 1
  return `${'../'.repeat(depth + extraUp)}${target}`
}

function buildHeader(configFile: string, body: string, relDomain: string): string {
  const domainFile = join(DOMAIN_ROOT, relDomain)
  const entityConfigPath = relImport(configFile, 'entity-config', 1)
  const portsPath = relImport(configFile, 'ports/school-repositories', 3)
  const tenantPath = `${entityConfigPath}/tenant`
  const helperPath = `${entityConfigPath}/helper-utils`

  const entity = collectEntityImports(body, domainFile)
  const entityConfigUsed = collectUsed(body, ENTITY_CONFIG_SYMBOLS)
  const tenantUsed = collectUsed(body, TENANT_SYMBOLS)
  const helperUsed = collectUsed(body, HELPER_SYMBOLS)
  const managedUsed = collectUsed(body, MANAGED_TYPE_SYMBOLS)
  const authValues = collectUsed(body, AUTH_VALUE_SYMBOLS)
  const authTypes = collectUsed(body, AUTH_TYPE_SYMBOLS)
  const coreValues = collectUsed(body, CORE_VALUE_SYMBOLS)

  const lines: string[] = []

  const coreImports = [...entity.values, ...coreValues.filter(s => s === 'BusinessRuleViolationError')]
  if (coreImports.length > 0) {
    lines.push(`import { ${coreImports.join(', ')} } from '@edaya/core'`)
  }
  if (entity.types.length > 0) {
    lines.push(`import type { ${entity.types.join(', ')} } from '@edaya/core'`)
  }
  if (body.includes('CoreEntityRepositories')) {
    lines.push(`import type { CoreEntityRepositories } from '@edaya/core'`)
  }
  if (body.includes('SchoolRepositories')) {
    lines.push(`import type { SchoolRepositories } from '${portsPath}'`)
  }
  if (entityConfigUsed.length > 0) {
    lines.push(`import { ${entityConfigUsed.join(', ')} } from '${entityConfigPath}'`)
  }
  if (managedUsed.length > 0) {
    lines.push(`import type { ${managedUsed.join(', ')} } from '${entityConfigPath}'`)
  }
  if (tenantUsed.length > 0) {
    lines.push(`import { ${tenantUsed.join(', ')} } from '${tenantPath}'`)
  }
  if (helperUsed.length > 0) {
    lines.push(`import { ${helperUsed.join(', ')} } from '${helperPath}'`)
  }
  if (authValues.length > 0) {
    lines.push(`import { ${authValues.join(', ')} } from '@edaya/authorization'`)
  }
  if (authTypes.length > 0) {
    lines.push(`import type { ${authTypes.join(', ')} } from '@edaya/authorization'`)
  }
  if (body.includes('resolveAttendanceRecordSchoolId')) {
    lines.push(`import { resolveAttendanceRecordSchoolId } from '@edaya/core/scheduling/attendance-record-school'`)
  }
  if (body.includes('assertDraftReportCardForTeacherComment')) {
    lines.push(`import { assertDraftReportCardForTeacherComment, assertCommentOnlyReportCardUpdate, collectCommentChanges } from '@edaya/core/assessments/report-card-comment-rules'`)
  }
  if (body.includes('isActivityAvailableForClassGroup') && !entity.values.includes('isActivityAvailableForClassGroup')) {
    lines.push(`import { isActivityAvailableForClassGroup } from '@edaya/core/school-life/class-activity-enrollment'`)
  }

  return `${lines.join('\n')}\n\n// Extracted from domain/${relDomain} (PR3)\n`
}

function fixConfig(configFile: string): void {
  const raw = readFileSync(configFile, 'utf8')
  const marker = raw.indexOf('// Extracted from')
  if (marker === -1) {
    return
  }
  const body = raw.slice(marker).replace(/^\/\/ Extracted from[^\n]*\n/, '')
  const header = buildHeader(configFile, body, relative(CONFIG_ROOT, configFile))
  writeFileSync(configFile, `${header + body.trimEnd()}\n`)
}

function cleanDomain(domainFile: string): void {
  let content = readFileSync(domainFile, 'utf8')
  if (!content.includes('export const ') && !/export class/.test(content)) {
    return
  }

  // Remove broken partial import blocks
  content = content.replace(/^import \{\n[\s\S]*?^import \{/gm, 'import {')

  const lines = content.split('\n')
  const result: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (line.startsWith('import ')) {
      // skip orphan import starts without closing
      if (line.includes('{') && !line.includes('}') && !line.includes('from')) {
        i += 1
        while (i < lines.length && !lines[i]!.includes('from ')) {
          i += 1
        }
        if (i < lines.length) {
          i += 1
        }
        continue
      }
    }
    result.push(line)
    i += 1
  }
  content = result.join('\n')

  // Remove unused imports heuristically
  const importRegex = /^import (?:type )?\{([^}]+)\} from '([^']+)';?\s*$/gm
  content = content.replace(importRegex, (full, symbols: string, from: string) => {
    const names = symbols.split(',').map(s => s.trim().split(/\s+as\s+/)[0]!.trim()).filter(Boolean)
    const used = names.filter((name) => {
      const body = content.replace(full, '')
      return new RegExp(`\\b${name}\\b`).test(body)
    })
    if (used.length === 0) {
      return ''
    }
    const isTypeOnly = full.startsWith('import type')
    const rebuilt = used.join(', ')
    return isTypeOnly ? `import type { ${rebuilt} } from '${from}'\n` : `import { ${rebuilt} } from '${from}'\n`
  })

  content = content.replace(/\n{3,}/g, '\n\n').trimStart()
  if (!content.endsWith('\n')) {
    content += '\n'
  }
  writeFileSync(domainFile, content)
}

for (const configFile of walkTsFiles(CONFIG_ROOT)) {
  fixConfig(configFile)
  cleanDomain(join(DOMAIN_ROOT, relative(CONFIG_ROOT, configFile)))
}

for (const domainFile of walkTsFiles(DOMAIN_ROOT)) {
  cleanDomain(domainFile)
}

// attendance-record-school helper
const ars = join(DOMAIN_ROOT, 'scheduling/attendance-record-school.ts')
let arsContent = readFileSync(ars, 'utf8')
if (!arsContent.includes('CoreEntityRepositories')) {
  arsContent = `import type { CoreEntityRepositories } from '@edaya/core'\n${arsContent.replace('SchoolRepositories', 'CoreEntityRepositories')}`
  writeFileSync(ars, arsContent)
}

console.log('Regenerated config import headers')
