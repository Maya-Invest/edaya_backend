/**
 * Apply targeted import fixes for extracted entity configs.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const CONFIG_ROOT = join(import.meta.dir, '../../package/domain-service/src/services/entities/config')
const DOMAIN_ROOT = join(import.meta.dir, '../../package/domain-core/src/domain')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory())
      out.push(...walk(p))
    else if (e.name.endsWith('.ts') && e.name !== 'index.ts')
      out.push(p)
  }
  return out
}

function upsertImport(content: string, line: string): string {
  if (content.includes(line))
    return content
  const marker = content.indexOf('// Extracted from')
  if (marker === -1)
    return content
  return `${content.slice(0, marker) + line}\n${content.slice(marker)}`
}

function fixPathImports(content: string): string {
  return content
    .replace(/@edaya\/core\/scheduling\//g, '@edaya/core/domain/scheduling/')
    .replace(/@edaya\/core\/assessments\//g, '@edaya/core/domain/assessments/')
    .replace(/@edaya\/core\/school-life\//g, '@edaya/core/domain/school-life/')
}

const perFile: Record<string, string[]> = {
  'messaging/announcement-target.ts': [
    `import { announcementLinkedTenant } from '../../entity-config/tenant'`,
  ],
  'messaging/school-notification-templates.ts': [
    `import { denyResourceAccess } from '@edaya/authorization'`,
    `async function denyTemplateEntityWrite(): Promise<void> { denyResourceAccess() }`,
  ],
  'assessments/assessment.ts': [
    `import { assertNoClassGroupScheduleConflict } from '../../../workflows/schedule-conflicts'`,
  ],
  'assessments/report-card-definition.ts': [
    `import { requireSchool } from '../../../require-school'`,
  ],
  'school/grade-scale.ts': [
    `import { requireSchool } from '../../../require-school'`,
  ],
  'assessments/assessment-result.ts': [
    `import { StudentClassEnrollmentStatus } from '@edaya/core'`,
    `import { ReportCardResultStatus } from '@edaya/core'`,
  ],
  'finances/payment.ts': [
    `import { FeeStatus, AttachmentOwnerKind } from '@edaya/core'`,
  ],
  'scheduling/activity-session.ts': [
    `import { OccurrenceStatus } from '@edaya/core'`,
  ],
  'scheduling/attendance-record.ts': [
    `import type { AttendanceAnchor } from '@edaya/core'`,
    `import { AttendanceStatus, AttendanceJustificationStatus } from '@edaya/core'`,
  ],
}

// Move isActivityAvailableForClassGroup back to domain
const domainCae = join(DOMAIN_ROOT, 'school-life/class-activity-enrollment.ts')
const configCae = join(CONFIG_ROOT, 'school-life/class-activity-enrollment.ts')
const caeConfig = readFileSync(configCae, 'utf8')
const fnMatch = caeConfig.match(/export async function isActivityAvailableForClassGroup[\s\S]*?\n\}/)
if (fnMatch) {
  const domain = readFileSync(domainCae, 'utf8')
  if (!domain.includes('isActivityAvailableForClassGroup')) {
    writeFileSync(domainCae, `${domain.trimEnd()}\n\n${fnMatch[0].replace('SchoolRepositories', 'CoreEntityRepositories')}\n`)
    writeFileSync(domainCae, readFileSync(domainCae, 'utf8').replace(
      /^/,
      `import type { CoreEntityRepositories } from '@edaya/core'\n`,
    ))
  }
  writeFileSync(configCae, caeConfig.replace(`${fnMatch[0]}\n`, ''))
}

for (const file of walk(CONFIG_ROOT)) {
  const rel = relative(CONFIG_ROOT, file)
  let content = readFileSync(file, 'utf8')
  content = fixPathImports(content)
  for (const line of perFile[rel] ?? []) {
    if (line.startsWith('async function')) {
      if (!content.includes(line.split('(')[0]!)) {
        const marker = content.indexOf('// Extracted from')
        content = `${content.slice(0, marker) + line}\n\n${content.slice(marker)}`
      }
    }
    else {
      content = upsertImport(content, line)
    }
  }
  writeFileSync(file, content)
}

console.log('Applied supplemental config fixes')
