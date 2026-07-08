/**
 * Rewrites consumer imports after core / authorization / school-service split.
 * Run: bun tooling/repo/migrate-consumer-imports.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '../..')
const targets = [
  join(root, 'apps/api'),
  join(root, 'package/adaptor-postgres'),
  join(root, 'package/adaptor-novu'),
  join(root, 'package/domain-service/tests'),
  join(root, 'package/authorization/tests'),
  join(root, 'tooling/fixtures'),
  join(root, 'tooling/seeding'),
  join(root, 'tooling/integration-tests'),
  join(root, 'tooling/novu-ops'),
  join(root, 'tooling/db-migrate'),
]

const AUTH_SYMBOLS = new Set([
  'ActorMetadata',
  'ActorAssuranceLevel',
  'AuthorizationError',
  'AuthorizationErrorCode',
  'AuthorizationPolicy',
  'Permission',
  'EffectiveGrants',
  'ScopeGrant',
  'ScopeGrantInput',
  'ScopeType',
  'scopeGrantSchema',
  'InteractiveActorMetadata',
  'StaffActorMetadata',
  'GuardianActorMetadata',
  'StudentActorMetadata',
  'TeacherActorMetadata',
  'TeacherActorScope',
  'GuardianScope',
  'StudentScope',
  'authorize',
  'createSystemActorMetadata',
  'createBootstrapStaffActorMetadata',
  'createStaffActorMetadata',
  'createGuardianActorMetadata',
  'createStudentActorMetadata',
  'createTeacherActorMetadata',
  'createRepositoryAuthorizationPolicy',
  'DefaultAuthorizationRepository',
  'bootstrapActorMetadata',
  'AuthCacheInvalidationEvent',
  'AuthCacheInvalidationPort',
  'QueryOperations',
  'ReportCardOperations',
  'SchedulingOperations',
  'AccessControlOperations',
  'FinanceOperations',
  'AcademicsOperations',
  'StudentOperations',
  'TeacherOperations',
  'AssessmentsOperations',
  'CommunicationsOperations',
  'LogbookOperations',
  'SchoolStructureOperations',
  'AttachmentsOperations',
  'AttachmentOperations',
  'GradesOperations',
  'DisciplineOperations',
  'ServiceAccountOperations',
  'PlatformOperations',
  'WorkspaceOperations',
  'ResourcesOperations',
  'AttendanceOperations',
  'TeachersOperations',
  'StudentsOperations',
  'ReportCardsOperations',
  'operationModule',
  'denyResourceAccess',
  'resolveAuditActorId',
  'assertCapability',
  'assertOperation',
  'assertCommandActorKind',
  'SCHOOL_COMMAND_KEYS',
  'effectiveGrantsForActor',
  'isInteractiveActor',
  'parseInteractiveActorKind',
  'resolveActorScope',
  'resolveInteractiveActorIdentity',
  'actorHasSchoolWideGrant',
  'ALL_GUARDIAN_CAPABILITIES',
  'ALL_HOMEROOM_CAPABILITIES',
  'ALL_STUDENT_CAPABILITIES',
  'ALL_TEACHING_CAPABILITIES',
  'COORDINATOR_PERMISSIONS',
  'ASSIGNMENT_SCOPED_PERMISSIONS',
  'ELEVATED_STAFF_PERMISSIONS',
  'EMPTY_GUARDIAN_SCOPE',
  'EMPTY_TEACHER_SCOPE',
  'renderScopeIds',
  'listPermissionCatalog',
  'listServiceAccounts',
  'createServiceAccount',
  'updateServiceAccount',
  'revokeServiceAccount',
  'rotateServiceAccountKey',
  'permissionRowsFromTemplatePermissions',
])

const SERVICE_SYMBOLS = new Set([
  'SchoolService',
  'SchoolApplication',
  'SchoolRepositories',
  'ManagedEntityService',
  'BaseSchoolService',
  'ServiceArgs',
  'buildSchoolOverview',
  'GetSchoolOverviewInput',
  'SchoolOverview',
  'GetClassGroupTimetableInput',
  'ClassGroupTimetable',
  'CORE_ENTITY_KEYS',
  'CoreEntityServices',
  'CoreEntityKey',
  'SchoolCommandKey',
  'createInlineCronJobDispatcher',
  'CronJobKey',
  'CronJobDispatchMessage',
  'CronJobDispatcherPort',
  'CronHeartbeatSummary',
  'CronJobSchedule',
  'runCronJobForSchool',
  'runCronJobs',
  'CronApplication',
  'tickCronSchedules',
  'computeNextRunAt',
  'PublishAnnouncementInput',
  'findActiveAcademicYear',
  'requireSchool',
  'assertNoClassGroupScheduleConflict',
  'NotificationTemplateService',
  'dispatchSchoolCommand',
  'AUTH_EMAIL_VERIFICATION_EVENT_KEY',
  'AUTH_OTP_EVENT_KEY',
  'AUTH_PLATFORM_CONTEXT_ID',
  'ACCOUNT_INVITATION_EVENT_KEY',
  'NOTIFICATION_TEMPLATE_KEYS',
  'hashInvitationToken',
  'buildTransientInvitationSubscriberId',
  'resolveInviteeDisplayName',
  'scheduleNotificationRecipientBackfillForActor',
  'buildStorageKey',
  'buildAttachmentContentUrl',
  'assertUploadPolicyAllowed',
  'allowsPublicInlineAttachmentContent',
  'validateAttachmentSave',
])

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.svelte-kit')
      continue
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory())
      files.push(...walk(path))
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts'))
      files.push(path)
  }
  return files
}

function migrateFile(content: string): string {
  const importRegex = /import\s+(type\s+)?\{([^}]+)\}\s+from\s+["']@edaya\/core["'];?/g

  let next = content.replace(importRegex, (full, typeKeyword: string | undefined, body: string) => {
    const isTypeOnly = Boolean(typeKeyword)
    const entries = body.split(',').map(entry => entry.trim()).filter(Boolean)
    const core: string[] = []
    const auth: string[] = []
    const service: string[] = []

    for (const entry of entries) {
      const match = entry.match(/^(type\s+)?(\w+)(\s+as\s+\w+)?$/)
      if (!match) {
        core.push(entry)
        continue
      }
      const [, entryType, name, suffix] = match
      const symbol = name!
      const formatted = `${entryType ?? ''}${symbol}${suffix ?? ''}`.trim()
      if (AUTH_SYMBOLS.has(symbol))
        auth.push(formatted)
      else if (SERVICE_SYMBOLS.has(symbol))
        service.push(formatted)
      else core.push(formatted)
    }

    const lines: string[] = []
    if (core.length > 0) {
      lines.push(`import ${isTypeOnly ? 'type ' : ''}{ ${core.join(', ')} } from "@edaya/core"`)
    }
    if (auth.length > 0) {
      lines.push(`import ${isTypeOnly ? 'type ' : ''}{ ${auth.join(', ')} } from "@edaya/authorization"`)
    }
    if (service.length > 0) {
      lines.push(`import ${isTypeOnly ? 'type ' : ''}{ ${service.join(', ')} } from "@edaya/service"`)
    }
    return lines.join('\n')
  })

  next = next.replace(
    /import\s+type\s+\{([^}]+)\}\s+from\s+["']@edaya\/core["'];?/g,
    (_full, _body) => _full,
  )

  next = next.replace(
    /from\s+["']@edaya\/core["']/g,
    (match, offset, str) => {
      const lineStart = str.lastIndexOf('\n', offset) + 1
      const line = str.slice(lineStart, str.indexOf('\n', offset))
      if (line.includes('AuthCacheInvalidation'))
        return 'from "@edaya/authorization"'
      if (line.includes('createInlineCronJobDispatcher') || line.includes('CronJob'))
        return 'from "@edaya/service"'
      return match
    },
  )

  return next
}

let changed = 0
for (const target of targets) {
  for (const file of walk(target)) {
    const original = readFileSync(file, 'utf8')
    const updated = migrateFile(original)
    if (updated !== original) {
      writeFileSync(file, updated)
      changed++
    }
  }
}

console.log(`Updated ${changed} consumer files`)
