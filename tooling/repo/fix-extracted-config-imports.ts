/**
 * Fix imports in extracted entity config files and clean leftover domain artifacts.
 *
 * Usage: bun tooling/repo/fix-extracted-config-imports.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dir, '../..')
const DOMAIN_ROOT = join(ROOT, 'package/domain-core/src/domain')
const CONFIG_ROOT = join(ROOT, 'package/school-service/src/services/entities/config')

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

const MANAGED_SYMBOLS = ['EntityTenantResolver', 'EntityWriteAuthorization', 'EntityReadAuthorization'] as const

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

function entityConfigImportPath(configFile: string): string {
  const depth = relative(CONFIG_ROOT, configFile).split('/').length - 1
  return `${'../'.repeat(depth + 1)}entity-config`
}

function collectUsed(content: string, symbols: readonly string[]): string[] {
  return symbols.filter(symbol => new RegExp(`\\b${symbol}\\b`).test(content))
}

function collectCoreValueImports(content: string, domainFile: string): string[] {
  if (!exists(domainFile)) {
    return []
  }
  const domain = readFileSync(domainFile, 'utf8')
  const values: string[] = []
  for (const match of domain.matchAll(/export class (\w+)/g)) {
    if (content.includes(match[1]!)) {
      values.push(match[1]!)
    }
  }
  for (const match of domain.matchAll(/export enum (\w+)/g)) {
    if (content.includes(match[1]!)) {
      values.push(match[1]!)
    }
  }
  for (const match of domain.matchAll(/export (?:async )?function (\w+)/g)) {
    if (content.includes(match[1]!)) {
      values.push(match[1]!)
    }
  }
  return [...new Set(values)]
}

function exists(path: string): boolean {
  try {
    readFileSync(path)
    return true
  }
  catch {
    return false
  }
}

function collectAuthorizationImports(content: string): string[] {
  const symbols = new Set<string>()
  const known = [
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
  ]
  for (const symbol of known) {
    if (new RegExp(`\\b${symbol}\\b`).test(content)) {
      symbols.add(symbol)
    }
  }
  return [...symbols]
}

function collectCoreTypeImports(content: string): string[] {
  const types = new Set<string>()
  if (content.includes('BusinessRuleViolationError')) {
    types.add('BusinessRuleViolationError')
  }
  if (content.includes('CoreEntityRepositories')) {
    types.add('CoreEntityRepositories')
  }
  if (content.includes('OperationRef')) {
    types.add('OperationRef')
  }
  if (content.includes('AuthorizationPolicy')) {
    types.add('AuthorizationPolicy')
  }
  if (content.includes('ActorMetadata')) {
    types.add('ActorMetadata')
  }
  return [...types]
}

function collectCorePathImports(content: string): string[] {
  const imports: string[] = []
  const paths = [
    'scheduling/attendance-record-school',
    'assessments/report-card-comment-rules',
  ]
  for (const path of paths) {
    const fn = path.split('/').pop()!
    const base = fn!.replace(/-school$/, '').replace(/-rules$/, '')
    if (content.includes('resolveAttendanceRecordSchoolId')) {
      imports.push(`import { resolveAttendanceRecordSchoolId } from '@edaya/core/scheduling/attendance-record-school'`)
    }
    if (content.includes('assertDraftReportCardForTeacherComment') || content.includes('collectCommentChanges')) {
      imports.push(`import { assertDraftReportCardForTeacherComment, assertCommentOnlyReportCardUpdate, collectCommentChanges } from '@edaya/core/assessments/report-card-comment-rules'`)
    }
    void base
  }
  if (content.includes('resolveAttendanceRecordSchoolId') && !imports.some(i => i.includes('attendance-record-school'))) {
    imports.push(`import { resolveAttendanceRecordSchoolId } from '@edaya/core/scheduling/attendance-record-school'`)
  }
  return [...new Set(imports)]
}

function fixConfigFile(configFile: string): void {
  const rel = relative(CONFIG_ROOT, configFile)
  const domainFile = join(DOMAIN_ROOT, rel)
  const raw = readFileSync(configFile, 'utf8')
  const bodyMatch = raw.match(/\/\/ Extracted from[^\n]*\n([\s\S]*)$/)
  const body = bodyMatch?.[1] ?? raw
  const entityConfigPath = entityConfigImportPath(configFile)

  const entityConfigUsed = collectUsed(body, ENTITY_CONFIG_SYMBOLS)
  const tenantUsed = collectUsed(body, TENANT_SYMBOLS)
  const helperUsed = collectUsed(body, HELPER_SYMBOLS)
  const managedUsed = collectUsed(body, MANAGED_SYMBOLS)
  const coreValues = collectCoreValueImports(body, domainFile)
  const authSymbols = collectAuthorizationImports(body)
  const coreTypes = collectCoreTypeImports(body)

  const lines: string[] = []

  if (coreValues.length > 0) {
    lines.push(`import { ${coreValues.join(', ')} } from '@edaya/core'`)
  }
  if (coreTypes.length > 0) {
    const typeOnly = coreTypes.filter(t => !coreValues.includes(t))
    if (typeOnly.length > 0) {
      lines.push(`import type { ${typeOnly.join(', ')} } from '@edaya/core'`)
    }
  }

  if (body.includes('SchoolRepositories')) {
    const depth = relative(CONFIG_ROOT, configFile).split('/').length - 1
    const portsPath = `${'../'.repeat(depth + 2)}ports/school-repositories`
    lines.push(`import type { SchoolRepositories } from '${portsPath}'`)
  }

  if (entityConfigUsed.length > 0 || tenantUsed.length > 0 || helperUsed.length > 0 || managedUsed.length > 0) {
    const all = [...entityConfigUsed, ...tenantUsed, ...helperUsed, ...managedUsed]
    const typeOnly = managedUsed
    const values = all.filter(s => !typeOnly.includes(s as typeof managedUsed[number]))
    if (typeOnly.length > 0) {
      lines.push(`import type { ${typeOnly.join(', ')} } from '${entityConfigPath}'`)
    }
    if (values.length > 0) {
      lines.push(`import { ${values.join(', ')} } from '${entityConfigPath}'`)
    }
    if (tenantUsed.length > 0) {
      const tenantPath = `${entityConfigPath}/tenant`
      lines.push(`import { ${tenantUsed.join(', ')} } from '${tenantPath}'`)
    }
    if (helperUsed.length > 0) {
      const helperPath = `${entityConfigPath}/helper-utils`
      lines.push(`import { ${helperUsed.join(', ')} } from '${helperPath}'`)
    }
  }

  if (authSymbols.length > 0) {
    lines.push(`import { ${authSymbols.join(', ')} } from '@edaya/authorization'`)
  }

  if (body.includes('AuthorizationPolicy') && !authSymbols.includes('AuthorizationPolicy')) {
    lines.push(`import type { AuthorizationPolicy } from '@edaya/authorization'`)
  }

  lines.push(...collectCorePathImports(body))

  const relDomain = `domain/${rel}`
  const output = `${lines.join('\n')}\n\n// Extracted from ${relDomain} (PR3)\n${body.trimEnd()}\n`
  writeFileSync(configFile, output)
}

function cleanDomainFile(domainFile: string): void {
  let content = readFileSync(domainFile, 'utf8')

  // Remove orphan config helper stubs left at file end
  content = content.replace(/\nasync function deny\w+EntityWrite\(\): Promise<void> \{\n {2}denyResourceAccess\(\)\n\}\n\n\/\*\*[\s\S]*?\*\/\n?$/m, '\n')
  content = content.replace(/\nasync function deny\w+EntityWrite\(\): Promise<void> \{\n {2}denyResourceAccess\(\)\n\}\n?$/m, '\n')

  // Drop unused school-service import blocks
  content = content.replace(/^import type \{[^}]+\} from '@edaya\/school-service'\n/gm, '')
  content = content.replace(/^import \{[^}]+\} from '@edaya\/school-service'\n/gm, '')
  content = content.replace(/^import type \{ CoreEntityRepositories \} from '@edaya\/core'\n/gm, '')

  // Drop unused authorization imports when no longer referenced
  const lines = content.split('\n')
  const kept: string[] = []
  for (const line of lines) {
    if (line.includes('from \'@edaya/authorization\'')) {
      const symbols = [...line.matchAll(/\b([A-Z][A-Za-z0-9]+)\b/g)].map(m => m[1]!)
      const used = symbols.some((s) => {
        if (['import', 'type', 'from', 'authorization'].includes(s)) {
          return false
        }
        return content.includes(s)
      })
      if (!used) {
        continue
      }
    }
    kept.push(line)
  }
  content = kept.join('\n')

  // Remove unused BusinessRuleViolationError import if not used
  if (!content.includes('BusinessRuleViolationError') && content.includes('BusinessRuleViolationError')) {
    // noop
  }
  if (!/\bBusinessRuleViolationError\b/.test(content.replace(/import[^;]+BusinessRuleViolationError[^;]+;/, ''))) {
    content = content.replace(/^import \{ BusinessRuleViolationError \}[^\n]+\n/gm, '')
    content = content.replace(/^import \{ BusinessRuleViolationError, [^}]+\}[^\n]+\n/gm, (m) => {
      return m.replace('BusinessRuleViolationError, ', '').replace(', BusinessRuleViolationError', '')
    })
  }

  content = `${content.replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
  writeFileSync(domainFile, content)
}

for (const configFile of walkTsFiles(CONFIG_ROOT)) {
  fixConfigFile(configFile)
  const rel = relative(CONFIG_ROOT, configFile)
  cleanDomainFile(join(DOMAIN_ROOT, rel))
}

// Clean all domain files that were extracted (even if config path differs)
for (const domainFile of walkTsFiles(DOMAIN_ROOT)) {
  cleanDomainFile(domainFile)
}

console.log('Fixed extracted config imports and cleaned domain files')
