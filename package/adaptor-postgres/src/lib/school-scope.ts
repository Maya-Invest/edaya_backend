import type { SQLWrapper } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { and, eq, getTableColumns, getTableName, is, isNotNull, isNull, or, SQL, sql } from 'drizzle-orm'
import * as schema from '../postgres-schema'

// Adapter-owned relationships. Every supplied business reference must stay in the
// tenant, including secondary references on records with their own schoolId.
const relatedFields: Record<string, PgTable> = {
  academicYearId: schema.academicYears,
  disciplineId: schema.academicDisciplines,
  placementStatusId: schema.placementStatuses,
  periodId: schema.academicPeriods,
  gradeLevelId: schema.gradeLevels,
  subjectMatterId: schema.subjectMatters,
  classGroupId: schema.classGroups,
  classSubjectId: schema.classSubjects,
  classSubjectMatterId: schema.classSubjectMatters,
  studentId: schema.students,
  guardianId: schema.guardians,
  staffId: schema.staffMembers,
  profileId: schema.staffPermissionProfiles,
  sourceProfileId: schema.staffPermissionProfiles,
  teacherId: schema.teachers,
  activityId: schema.activities,
  catalogServiceId: schema.catalogServices,
  accountId: schema.studentYearAccounts,
  enrollmentId: schema.studentServiceEnrollments,
  chargeId: schema.studentCharges,
  assessmentId: schema.assessments,
  attendanceId: schema.attendances,
  lessonSessionId: schema.lessonSessions,
  activitySessionId: schema.activitySessions,
  scheduleId: schema.schedules,
  reportCardDefinitionId: schema.reportCardDefinitions,
  gradeScaleId: schema.gradeScales,
  incidentId: schema.incidents,
  disciplinaryActionId: schema.disciplinaryActions,
  resourceId: schema.resources,
  announcementId: schema.announcements,
}
const academicSubjectTables = new Set(['class_subjects', 'subject_matters', 'report_card_definition_sections'])
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
    return proposed ? is(proposed[field], SQL) ? proposed[field] as SQL : sql`${sql.param(proposed[field] ?? null, column)}::text` : column
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
  const references = Object.entries(relatedFields)
  if (academicSubjectTables.has(name))
    references.push(['subjectId', schema.subjects])
  for (const [field, target] of references) {
    const column = columns[field]
    if (!column || (proposed && !column.notNull && proposed[field] == null))
      continue
    const withinSchool = parentScope(field, target)
    predicates.push(column.notNull ? withinSchool : or(isNull(value(field)), withinSchool)!)
  }
  const typedReferences: Record<string, { kind: string, id: string, targets: Record<string, PgTable>, broadcast?: string[], optional?: boolean }> = {
    calendar_events: { kind: 'scopeKind', id: 'scopeId', targets: { class_group: schema.classGroups, grade_level: schema.gradeLevels }, broadcast: ['school'] },
    announcement_targets: { kind: 'targetKind', id: 'targetId', targets: { class_group: schema.classGroups, grade_level: schema.gradeLevels, staff_member: schema.staffMembers, guardian: schema.guardians, student: schema.students }, broadcast: ['school', 'all_staff', 'all_guardians', 'all_students'] },
    message_deliveries: { kind: 'recipientKind', id: 'recipientId', targets: { staff: schema.staffMembers, teacher: schema.teachers, guardian: schema.guardians, student: schema.students }, optional: true },
    account_invitations: { kind: 'kind', id: 'targetId', targets: { staff: schema.staffMembers, teacher: schema.teachers, guardian: schema.guardians, student: schema.students } },
  }
  const typed = typedReferences[name]
  if (typed) {
    const alternatives = Object.entries(typed.targets).map(([kind, parent]) => and(sql`${value(typed.kind)} = ${kind}`, parentScope(typed.id, parent))!)
    for (const kind of typed.broadcast ?? [])
      alternatives.push(and(sql`${value(typed.kind)} = ${kind}`, isNull(value(typed.id)))!)
    if (typed.optional)
      alternatives.push(and(isNull(value(typed.kind)), isNull(value(typed.id)))!)
    predicates.push(or(...alternatives)!)
  }
  const links = anchors[name]
  if (links) {
    // At least one anchor must exist; every supplied anchor must stay in-school.
    predicates.push(or(...links.map(([field]) => isNotNull(value(field))))!)
  }
  if (predicates.length === 0)
    throw new Error(`No school ownership predicate for ${name}`)
  return and(...predicates)!
}
