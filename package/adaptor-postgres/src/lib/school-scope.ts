import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { and, eq, getTableColumns, getTableName, isNotNull, isNull, or, sql } from 'drizzle-orm'
import * as schema from '../postgres-schema'

// Adapter-owned ownership paths. Never accept table names or paths from caller filters.
const parents: Record<string, [string, PgTable]> = {
  subject_matters: ['subjectId', schema.subjects],
  grade_level_subjects: ['gradeLevelId', schema.gradeLevels],
  grade_level_subject_matters: ['gradeLevelSubjectId', schema.gradeLevelSubjects],
  class_subjects: ['classGroupId', schema.classGroups],
  class_subject_matters: ['classSubjectId', schema.classSubjects],
  class_subject_progress: ['classSubjectMatterId', schema.classSubjectMatters],
  student_class_enrollments: ['studentId', schema.students],
  student_fees: ['studentId', schema.students],
  payments: ['studentFeeId', schema.studentFees],
  assessments: ['classGroupId', schema.classGroups],
  assessment_results: ['assessmentId', schema.assessments],
  report_card_definition_sections: ['reportCardDefinitionId', schema.reportCardDefinitions],
  report_card_results: ['studentId', schema.students],
  teacher_assignments: ['teacherId', schema.teachers],
  teacher_unavailabilities: ['teacherId', schema.teachers],
  resource_assignments: ['resourceId', schema.resources],
  student_incident_involvements: ['incidentId', schema.incidents],
  activity_enrollments: ['activityId', schema.activities],
  class_activity_enrollments: ['classGroupId', schema.classGroups],
  announcement_targets: ['announcementId', schema.announcements],
  schedules: ['classGroupId', schema.classGroups],
  lesson_sessions: ['classGroupId', schema.classGroups],
  activity_sessions: ['classGroupId', schema.classGroups],
  attendances: ['classGroupId', schema.classGroups],
}
const anchors: Record<string, Array<[string, PgTable]>> = {
  staff_assignments: [
    ['classGroupId', schema.classGroups],
    ['classSubjectId', schema.classSubjects],
    ['lessonSessionId', schema.lessonSessions],
    ['activitySessionId', schema.activitySessions],
    ['assessmentId', schema.assessments],
  ],
  attendance_records: [
    ['attendanceId', schema.attendances],
    ['lessonSessionId', schema.lessonSessions],
    ['activitySessionId', schema.activitySessions],
    ['assessmentId', schema.assessments],
  ],
}

/** Build a correlated EXISTS predicate, also usable against proposed insert values. */
export function schoolScope(table: PgTable, schoolId: string, proposed?: Record<string, unknown>): SQL {
  const columns = getTableColumns(table)
  const name = getTableName(table)
  const value = (field: string): SQLWrapper => {
    const column = columns[field]
    if (!column)
      throw new Error(`Missing ownership column ${name}.${field}`)
    return proposed ? sql`${sql.param(proposed[field] ?? null, column)}::text` : column
  }
  const parentScope = (field: string, parent: PgTable): SQL => {
    const { id: parentId } = getTableColumns(parent)
    return sql`exists (select 1 from ${parent} where ${eq(parentId!, value(field))} and ${schoolScope(parent, schoolId)})`
  }
  if (name === 'schools' || name === 'school_notification_templates')
    return sql`${value('id')} = ${schoolId}`

  const predicates: SQL[] = []
  const { schoolId: schoolColumn } = columns
  if (schoolColumn)
    predicates.push(sql`${value('schoolId')} = ${schoolId}`)
  const parent = parents[name]
  if (parent)
    predicates.push(parentScope(...parent))
  // A result belongs to both its assessment and its student. Corrupt links must
  // never expose a foreign student's data through a local assessment.
  if (name === 'assessment_results') predicates.push(parentScope('studentId', schema.students))
  const links = anchors[name]
  if (links) {
    // At least one anchor must exist; every supplied anchor must stay in-school.
    predicates.push(or(...links.map(([field]) => isNotNull(value(field))))!)
    predicates.push(...links.map(([field, target]) => or(isNull(value(field)), parentScope(field, target))!))
  }
  if (predicates.length === 0)
    throw new Error(`No school ownership predicate for ${name}`)
  return and(...predicates)!
}
