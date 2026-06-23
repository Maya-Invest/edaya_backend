import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = path.join(packageRoot, 'src/postgres-schema.ts')
let content = readFileSync(schemaPath, 'utf8')

if (!content.includes('definePerformanceIndexes')) {
  content = content.replace(
    "import { boolean, integer, jsonb, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core'",
    "import { boolean, integer, jsonb, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core'\nimport { definePerformanceIndexes } from './postgres-indexes'",
  )
}

const indexedTables = [
  'academic_years', 'academic_periods', 'period_definitions', 'grade_levels',
  'staff_members', 'service_api_keys', 'staff_assignments', 'access_roles',
  'access_role_permissions', 'staff_role_assignments', 'staff_role_assignment_roles',
  'attachments', 'resources', 'resource_assignments', 'fees', 'student_fees',
  'payments', 'schedules', 'sessions', 'calendar_events', 'attendance_records',
  'announcements', 'announcement_targets', 'message_deliveries', 'subjects',
  'subject_matters', 'class_groups', 'class_subjects', 'homework_assignments',
  'class_logbook_entries', 'homework_submissions', 'extracurricular_activities',
  'activity_enrollments', 'class_subject_matters', 'assessments', 'assessment_results',
  'grade_scales', 'report_card_definitions', 'report_card_definition_sections',
  'report_card_results', 'students', 'student_class_enrollments', 'guardians',
  'guardian_student_links', 'student_notes', 'student_health_profiles',
  'student_disciplinary_actions', 'disciplinary_actions', 'student_incident_involvements',
  'incidents',
] as const

for (const tableName of indexedTables) {
  const marker = `pgTable('${tableName}', {`
  const start = content.indexOf(marker)
  if (start === -1) {
    throw new Error(`Table not found: ${tableName}`)
  }

  let depth = 0
  let end = -1
  for (let i = start + marker.length - 1; i < content.length; i++) {
    const char = content[i]
    if (char === '{') depth++
    if (char === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }

  if (end === -1) {
    throw new Error(`Could not find closing brace for ${tableName}`)
  }

  const tail = content.slice(end, end + 80)
  if (tail.includes('definePerformanceIndexes')) {
    continue
  }

  const insert = `}, table => definePerformanceIndexes('${tableName}', table))`
  content = content.slice(0, end) + insert + content.slice(end + 2)
}

writeFileSync(schemaPath, content)
console.log(`Applied performance indexes to ${indexedTables.length} tables.`)
