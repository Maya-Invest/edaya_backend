/**
 * Fixes test imports after domain package split.
 * Run: bun tooling/repo/fix-test-imports.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '../..')
const targets = [
  join(root, 'package/domain-core/tests'),
  join(root, 'package/authorization/tests'),
  join(root, 'package/domain-service/tests'),
]

const VALIDATORS = [
  'validateAttachmentSave',
  'validateCalendarEventSave',
  'validateClassGroupSave',
  'validateClassGroupDelete',
  'validateLessonSessionSave',
  'validateScheduleSave',
  'validateStaffAssignmentSave',
  'validateStudentSave',
  'validateGradeLevelSubjectSave',
  'validateGradeLevelSubjectDelete',
  'validateGradeLevelSubjectMatterSave',
  'validateClassSubjectProgressSave',
  'validateActivitySessionSave',
  'validateTeacherAssignmentSave',
  'validateActivityDelete',
  'validateActivityEnrollmentSave',
  'validateClassActivityEnrollmentSave',
  'validateFeeSave',
  'validateFeeDelete',
  'validatePaymentSave',
  'validatePaymentDelete',
  'isLessonSessionLogbookOnlyUpdate',
  'isLessonSessionAttendanceCompletionUpdate',
]

const AUTH_SYMBOLS = new Set([
  'AuthorizationError',
  'ActorAssuranceLevel',
  'createRepositoryAuthorizationPolicy',
  'createStaffActorMetadata',
  'effectiveGrantsForRoles',
  'validateScopeIds',
  'invalidateAuthCacheForEvents',
  'AuthCacheInvalidationEvent',
  'authorizeReportCardCommentSave',
  'authorizeTeacherReportCardCommentSave',
  'teacherCanReadReportCard',
  'createGuardianActorMetadata',
  'createBootstrapStaffActorMetadata',
  'createTeacherActorMetadata',
  'createStudentActorMetadata',
  'ActorMetadata',
  'AuthorizationPolicy',
])

const SERVICE_SYMBOLS = new Set(VALIDATORS)

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules')
      continue
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory())
      files.push(...walk(path))
    else if (entry.endsWith('.ts'))
      files.push(path)
  }
  return files
}

const CORE_SYMBOLS = new Set([
  'AtomicExecutionPort',
  'BaseRepositoryInterface',
  'NotificationGatewayPort',
  'noOpNotificationGateway',
  'RecordingNotificationGateway',
  'noOpFileStorage',
  'Filter',
  'QueryOptions',
  'EntityWithId',
  'Guardian',
  'Student',
  'StaffMember',
  'GuardianStudentLink',
  'GuardianContactMethod',
  'GuardianContactMethodType',
  'MessageDeliveryRecipientKind',
  'School',
  'AcademicYear',
  'ClassGroup',
  'GradeLevel',
  'Subject',
  'Assessment',
])

function splitPackageImport(content: string, packageName: string, auth: Set<string>, service: Set<string>, core: Set<string>): string {
  const importRegex = new RegExp(`import\\s+(type\\s+)?\\{([^}]+)\\}\\s+from\\s+["']${packageName.replace('/', '\\/')}["'];?`, 'g')
  return content.replace(importRegex, (full, typeKeyword: string | undefined, body: string) => {
    const isTypeOnly = Boolean(typeKeyword)
    const coreImports: string[] = []
    const authImports: string[] = []
    const serviceImports: string[] = []

    for (const entry of body.split(',').map(e => e.trim()).filter(Boolean)) {
      const match = entry.match(/^(type\s+)?(\w+)(\s+as\s+\w+)?$/)
      if (!match) {
        coreImports.push(entry)
        continue
      }
      const [, entryType, name, suffix] = match
      const formatted = `${entryType ?? ''}${name}${suffix ?? ''}`.trim()
      if (auth.has(name!))
        authImports.push(formatted)
      else if (service.has(name!))
        serviceImports.push(formatted)
      else if (core.has(name!))
        coreImports.push(formatted)
      else if (packageName === '@edaya/service')
        serviceImports.push(formatted)
      else coreImports.push(formatted)
    }

    const lines: string[] = []
    if (coreImports.length > 0)
      lines.push(`import ${isTypeOnly ? 'type ' : ''}{ ${coreImports.join(', ')} } from "@edaya/core"`)
    if (authImports.length > 0)
      lines.push(`import ${isTypeOnly ? 'type ' : ''}{ ${authImports.join(', ')} } from "@edaya/authorization"`)
    if (serviceImports.length > 0)
      lines.push(`import ${isTypeOnly ? 'type ' : ''}{ ${serviceImports.join(', ')} } from "@edaya/service"`)
    return lines.join('\n')
  })
}

function splitCoreImport(content: string): string {
  let next = splitPackageImport(content, '@edaya/core', AUTH_SYMBOLS, SERVICE_SYMBOLS, CORE_SYMBOLS)
  next = splitPackageImport(next, '@edaya/service', AUTH_SYMBOLS, SERVICE_SYMBOLS, CORE_SYMBOLS)
  return next
}

function migrateFile(content: string, filePath: string): string {
  let next = content

  next = next.replace(/from ["']@edaya\/core\/[^"']+["']/g, 'from "@edaya/core"')
  next = next.replace(/from ["']@edaya\/domain-service\/account-linking\/[^"']+["']/g, 'from "@edaya/service"')
  next = next.replace(/from ["']@edaya\/domain-service\/entities\/[^"']+["']/g, 'from "@edaya/service"')
  next = next.replace(/from ["']@edaya\/core\/platform["']/g, 'from "@edaya/service"')

  next = next.replace(
    /from ["'](?:\.\.\/)+src\/capabilities\/authorization\/([^"']+)["']/g,
    'from "@edaya/authorization/$1"',
  )
  next = next.replace(
    /from ["'](?:\.\.\/)+src\/capabilities\/authorization["']/g,
    'from "@edaya/authorization"',
  )
  next = next.replace(
    /from ["'](?:\.\.\/)+src\/lifecycle\/auth-cache-hooks["']/g,
    'from "@edaya/service/integration/auth-cache-hooks"',
  )
  next = next.replace(
    /from ["'](?:\.\.\/)+src\/capabilities\/notifications([^"']*)["']/g,
    'from "@edaya/service/capabilities/notifications$1"',
  )
  next = next.replace(
    /from ["'](?:\.\.\/)+src\/capabilities\/invitations\/([^"']+)["']/g,
    'from "@edaya/service/capabilities/invitations/$1"',
  )
  next = next.replace(
    /from ["'](?:\.\.\/)+src\/workflows\/([^"']+)["']/g,
    'from "@edaya/service/services/workflows/$1"',
  )
  next = next.replace(
    /from ["'](?:\.\.\/)+src\/(academic-year|base-school-service|account-linking\/[^"']+)["']/g,
    'from "@edaya/service"',
  )
  next = next.replace(
    /from ["'](?:\.\.\/)+src\/entities\/([^"']+)["']/g,
    'from "@edaya/service"',
  )
  next = next.replace(
    /from ["']\.\.\/\.\.\/support\/authorization-fixtures["']/g,
    'from "../support/authorization-fixtures"',
  )
  next = next.replace(
    /from ["']\.\.\/\.\.\/\.\.\/src\/capabilities\/authorization\/policy\/compose["']/g,
    'from "@edaya/authorization/policy/compose"',
  )

  if (filePath.includes('entity-tenant-resolvers.test.ts')) {
    next = next.replace(
      /from ["']@edaya\/domain-service\/entities\/entity-config\/tenant["']/g,
      'from "@edaya/service/services/entities/entity-config/tenant"',
    )
  }

  if (filePath.includes('business-rule-exception-codes.test.ts')) {
    next = next.replace(/from ["']@edaya\/domain-service\/require-school["']/g, 'from "@edaya/service"')
  }

  if (filePath.includes('attachment-upload-policy.test.ts') || filePath.includes('read-storage-body.test.ts')) {
    next = next.replace(
      /from ["']@edaya\/domain-service\/capabilities\/files\/([^"']+)["']/g,
      'from "@edaya/service/capabilities/files/$1"',
    )
  }

  if (filePath.includes('report-card-comment-access.test.ts')) {
    next = next.replace(
      /from ["']@edaya\/core["']/g,
      (match, offset, str) => {
        const lineStart = str.lastIndexOf('\n', offset) + 1
        const line = str.slice(lineStart, str.indexOf('\n', offset))
        if (line.includes('assertDraft') || line.includes('collectComment') || line.includes('authorizeReportCard')) {
          return 'from "@edaya/authorization"'
        }
        return match
      },
    )
  }

  next = splitCoreImport(next)
  return next
}

let changed = 0
for (const target of targets) {
  for (const file of walk(target)) {
    const original = readFileSync(file, 'utf8')
    const updated = migrateFile(original, file)
    if (updated !== original) {
      writeFileSync(file, updated)
      changed++
    }
  }
}

console.log(`Updated ${changed} test files`)
