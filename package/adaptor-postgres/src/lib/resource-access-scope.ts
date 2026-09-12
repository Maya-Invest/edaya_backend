import type { AccessTarget, CoreEntityKey, GrantScope, ResourceAccessClause, ResourceAccessScope } from '@edaya/core'
import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { and, eq, getTableColumns, getTableName, inArray, or, sql } from 'drizzle-orm'
import * as s from '../postgres-schema'
import { schoolScope } from './school-scope'

const tables: Record<CoreEntityKey, PgTable> = {
  schools: s.schools, academicYears: s.academicYears, academicPeriods: s.academicPeriods,
  periodDefinitions: s.periodDefinitions, gradeLevels: s.gradeLevels, staffMembers: s.staffMembers,
  staffAssignments: s.staffAssignments, teachers: s.teachers, teacherAssignments: s.teacherAssignments,
  teacherUnavailabilities: s.teacherUnavailabilities, accountInvitations: s.accountInvitations,
  staffPermissionAssignments: s.staffPermissionAssignments, attachments: s.attachments,
  resources: s.resources, resourceAssignments: s.resourceAssignments, fees: s.fees,
  studentFees: s.studentFees, payments: s.payments, schedules: s.schedules,
  lessonSessions: s.lessonSessions, activitySessions: s.activitySessions, attendances: s.attendances,
  calendarEvents: s.calendarEvents, attendance: s.attendanceRecords, announcements: s.announcements,
  announcementTargets: s.announcementTargets, messageDeliveries: s.messageDeliveries,
  schoolNotificationTemplates: s.schoolNotificationTemplates, subjects: s.subjects,
  subjectMatters: s.subjectMatters, gradeLevelSubjects: s.gradeLevelSubjects,
  gradeLevelSubjectMatters: s.gradeLevelSubjectMatters, classGroups: s.classGroups,
  classSubjects: s.classSubjects, classSubjectMatters: s.classSubjectMatters,
  classSubjectProgress: s.classSubjectProgress, activities: s.activities,
  activityEnrollments: s.activityEnrollments, classActivityEnrollments: s.classActivityEnrollments,
  assessments: s.assessments, assessmentResults: s.assessmentResults, gradeScales: s.gradeScales,
  definitions: s.reportCardDefinitions, sections: s.reportCardDefinitionSections,
  results: s.reportCardResults, students: s.students, enrollments: s.studentClassEnrollments,
  guardians: s.guardians, guardianLinks: s.guardianStudentLinks, studentNotes: s.studentNotes,
  studentHealthProfiles: s.studentHealthProfiles, studentDisciplinaryActions: s.studentDisciplinaryActions,
  disciplinaryActions: s.disciplinaryActions, studentIncidentInvolvements: s.studentIncidentInvolvements,
  incidents: s.incidents,
}

const parents: Record<string, readonly [string, PgTable][]> = {
  payments: [['studentFeeId', s.studentFees]],
  assessment_results: [['assessmentId', s.assessments]],
  report_card_definition_sections: [['reportCardDefinitionId', s.reportCardDefinitions]],
  class_subject_matters: [['classSubjectId', s.classSubjects]],
  class_subject_progress: [['classSubjectMatterId', s.classSubjectMatters]],
  subject_matters: [['subjectId', s.subjects]],
  grade_level_subject_matters: [['gradeLevelSubjectId', s.gradeLevelSubjects]],
  student_incident_involvements: [['incidentId', s.incidents]],
  attendance_records: [['attendanceId', s.attendances], ['lessonSessionId', s.lessonSessions], ['activitySessionId', s.activitySessions], ['assessmentId', s.assessments]],
  staff_assignments: [['classSubjectId', s.classSubjects], ['lessonSessionId', s.lessonSessions], ['activitySessionId', s.activitySessions], ['assessmentId', s.assessments]],
  resource_assignments: [['lessonSessionId', s.lessonSessions], ['activitySessionId', s.activitySessions], ['assessmentId', s.assessments]],
  announcement_targets: [['announcementId', s.announcements]],
}

/** SQL compilation of policy constraints. No permission decisions are made here. */
export function compileResourceAccess(table: PgTable, scope: ResourceAccessScope, proposed?: Record<string, unknown>): SQL {
  if (getTableName(tables[scope.resource]) !== getTableName(table))
    throw new Error('Access scope resource does not match repository')
  const clauses = scope.clauses.map(clause => compileClause(table, clause, scope.schoolId, proposed))
  return and(schoolScope(table, scope.schoolId, proposed), clauses.length ? or(...clauses)! : sql`false`)!
}

function compileClause(table: PgTable, clause: ResourceAccessClause, schoolId: string, proposed?: Record<string, unknown>): SQL {
  const value = values(table, proposed)
  return and(
    targetPredicate(table, clause.target, schoolId, clause.academicYearId, new Set(), proposed),
    clause.academicYearId ? yearPredicate(table, clause.academicYearId, schoolId, new Set(), proposed) : undefined,
    clause.publishedOnly ? publicationPredicate(table, schoolId, value) : undefined,
    clause.noteVisibility === 'staff' ? sql`${value('visibility')} <> 'admin_only'` : undefined,
    clause.noteVisibility === 'guardian' ? sql`${value('visibility')} = 'guardian_visible'` : undefined,
    clause.authorStaffId ? sql`${value('authorStaffId')} = ${clause.authorStaffId}` : undefined,
    clause.attendanceMode === 'daily' ? sql`${value('attendanceId')} is not null` : undefined,
    clause.attendanceMode === 'session' ? sql`(${value('lessonSessionId')} is not null or ${value('assessmentId')} is not null)` : undefined,
  )!
}

function values(table: PgTable, proposed?: Record<string, unknown>): (field: string) => SQLWrapper {
  const columns = getTableColumns(table)
  return (field) => {
    if (!columns[field])
      throw new Error(`Unknown access field ${getTableName(table)}.${field}`)
    return proposed ? sql`${sql.param(proposed[field] ?? null, columns[field])}::${sql.raw(columns[field]!.getSQLType())}` : columns[field]!
  }
}

function exists(table: PgTable, schoolId: string, predicate: SQL): SQL {
  return sql`exists (select 1 from ${table} where ${schoolScope(table, schoolId)} and ${predicate})`
}

function activeEnrollment(year?: string): SQL {
  return and(eq(s.studentClassEnrollments.status, 'active'), year ? eq(s.studentClassEnrollments.academicYearId, year) : undefined)!
}

// An all-grain grant becomes a pattern without identifiers. It still has to reach
// that grain through tenant-bound relationships; it is not school authority.
type GrantPattern<T = GrantScope> = T extends { kind: string }
  ? Pick<T, 'kind'> & Partial<Omit<T, 'kind'>> : never
type TargetPattern = Exclude<AccessTarget, GrantScope> | GrantPattern

function targetPredicate(table: PgTable, target: TargetPattern, schoolId: string, year: string | undefined, visited: Set<string>, proposed?: Record<string, unknown>): SQL {
  if (target.kind === 'all') {
    if (!target.grain) throw new Error('All scope requires a grain')
    return targetPredicate(table, { kind: target.grain }, schoolId, year, visited, proposed)
  }
  const name = getTableName(table)
  if (visited.has(name))
    return sql`false`
  const seen = new Set([...visited, name])
  const columns = getTableColumns(table)
  const value = values(table, proposed)
  const matches = (field: string, id: string | undefined): SQL => id === undefined ? sql`${value(field)} is not null` : sql`${value(field)} = ${id}`
  const via = (field: string, parent: PgTable): SQL => exists(parent, schoolId,
    and(sql`${getTableColumns(parent)['id']!} = ${value(field)}`, targetPredicate(parent, target, schoolId, year, seen))!)

  if (target.kind === 'school') return sql`true`
  if (target.kind === 'records') return target.ids.length ? sql`${value('id')} in (${sql.join(target.ids.map(id => sql`${id}`), sql`, `)})` : sql`false`
  if (target.kind === 'recipient') {
    return name === 'message_deliveries'
      ? and(matches('recipientKind', target.actorKind), matches('recipientId', target.actorId))!
      : sql`false`
  }
  if (target.kind === 'audience') {
    if (name === 'announcement_targets') return via('announcementId', s.announcements)
    if (name !== 'announcements') return sql`false`
    const targets: SQL[] = [eq(s.announcementTargets.targetKind, 'school')]
    targets.push(and(eq(s.announcementTargets.targetKind, target.actorKind), eq(s.announcementTargets.targetId, target.actorId))!)
    if (target.studentIds.length) targets.push(and(eq(s.announcementTargets.targetKind, 'student'), inArray(s.announcementTargets.targetId, [...target.studentIds]))!)
    if (target.classGroupIds.length) targets.push(and(eq(s.announcementTargets.targetKind, 'class_group'), inArray(s.announcementTargets.targetId, [...target.classGroupIds]))!)
    return and(sql`${value('status')} = 'published'`, sql`(${value('expiresAt')} is null or ${value('expiresAt')} > now())`,
      sql`exists (select 1 from ${s.announcementTargets} where ${s.announcementTargets.announcementId} = ${value('id')} and ${or(...targets)})`)!
  }

  if (name === 'calendar_events') {
    const candidates: SQL[] = [sql`${value('scopeKind')} = 'school'`]
    if (target.kind === 'class_group') candidates.push(and(sql`${value('scopeKind')} = 'class_group'`, matches('scopeId', target.classGroupId))!)
    if (target.kind === 'student') candidates.push(and(sql`${value('scopeKind')} = 'class_group'`, exists(s.studentClassEnrollments, schoolId,
      and(target.studentId ? eq(s.studentClassEnrollments.studentId, target.studentId) : sql`true`, sql`${s.studentClassEnrollments.classGroupId} = ${value('scopeId')}`, activeEnrollment(year))!))!)
    return or(...candidates)!
  }

  if (target.kind === 'student') {
    if (name === 'students') return matches('id', target.studentId)
    if (columns['studentId']) return matches('studentId', target.studentId)
    if (name === 'guardians') return exists(s.guardianStudentLinks, schoolId, and(sql`${s.guardianStudentLinks.guardianId} = ${value('id')}`, target.studentId ? eq(s.guardianStudentLinks.studentId, target.studentId) : sql`true`)!)
    if (name === 'class_groups' || columns['classGroupId']) {
      const classId = name === 'class_groups' ? value('id') : value('classGroupId')
      return exists(s.studentClassEnrollments, schoolId, and(sql`${s.studentClassEnrollments.classGroupId} = ${classId}`, target.studentId ? eq(s.studentClassEnrollments.studentId, target.studentId) : sql`true`, activeEnrollment(year))!)
    }
    if (name === 'fees') return exists(s.studentFees, schoolId, and(sql`${s.studentFees.feeId} = ${value('id')}`, target.studentId ? eq(s.studentFees.studentId, target.studentId) : sql`true`)!)
    if (name === 'activities') return exists(s.activityEnrollments, schoolId, and(sql`${s.activityEnrollments.activityId} = ${value('id')}`, target.studentId ? eq(s.activityEnrollments.studentId, target.studentId) : sql`true`, eq(s.activityEnrollments.status, 'active'))!)
  }

  if (target.kind === 'class_group') {
    if (name === 'class_groups') return matches('id', target.classGroupId)
    if (columns['classGroupId']) return matches('classGroupId', target.classGroupId)
  }
  if (target.kind === 'class_subject') {
    if (name === 'class_subjects') return and(matches('classGroupId', target.classGroupId), target.classSubjectId ? matches('id', target.classSubjectId) : undefined)!
    if (columns['classSubjectId']) return via('classSubjectId', s.classSubjects)
    if (name === 'class_groups') return matches('id', target.classGroupId)
    // Class-wide resources are admitted only when the business policy selects them.
    if (columns['classGroupId']) return matches('classGroupId', target.classGroupId)
  }
  if (target.kind === 'grade_level' || target.kind === 'grade_level_subject') {
    if (name === 'grade_levels') return matches('id', target.gradeLevelId)
    if (name === 'grade_level_subjects') return and(matches('gradeLevelId', target.gradeLevelId),
      target.kind === 'grade_level_subject' && target.gradeLevelSubjectId ? matches('id', target.gradeLevelSubjectId) : undefined)!
    if (target.kind === 'grade_level_subject' && columns['gradeLevelSubjectId']) return via('gradeLevelSubjectId', s.gradeLevelSubjects)
    if (columns['gradeLevelId']) return matches('gradeLevelId', target.gradeLevelId)
  }
  if (target.kind === 'activity') {
    if (name === 'activities') return matches('id', target.activityId)
    if (columns['activityId']) return and(matches('activityId', target.activityId),
      target.classGroupId ? (columns['classGroupId'] ? matches('classGroupId', target.classGroupId) : sql`false`) : undefined)!
  }

  if (name === 'students') return exists(s.studentClassEnrollments, schoolId,
    and(sql`${s.studentClassEnrollments.studentId} = ${value('id')}`, activeEnrollment(year), targetPredicate(s.studentClassEnrollments, target, schoolId, year, seen))!)
  if (['assessment_results', 'attendance_records'].includes(name)) {
    const paths = (parents[name] ?? []).map(([field, parent]) => via(field, parent))
    return paths.length ? or(...paths)! : sql`false`
  }
  if (columns['studentId']) return via('studentId', s.students)
  if (name === 'guardians') return exists(s.guardianStudentLinks, schoolId,
    and(sql`${s.guardianStudentLinks.guardianId} = ${value('id')}`, targetPredicate(s.guardianStudentLinks, target, schoolId, year, seen))!)
  if (name === 'class_groups' && target.kind === 'activity') return exists(s.classActivityEnrollments, schoolId,
    and(sql`${s.classActivityEnrollments.classGroupId} = ${value('id')}`, target.activityId ? eq(s.classActivityEnrollments.activityId, target.activityId) : sql`true`)!)
  if (columns['classGroupId']) return via('classGroupId', s.classGroups)
  if (columns['classSubjectId']) return via('classSubjectId', s.classSubjects)
  if (name === 'subjects' || name === 'grade_level_subjects' || name === 'grade_levels') {
    const relation = name === 'grade_levels' ? s.classGroups : s.classSubjects
    const foreign = name === 'subjects' ? s.classSubjects.subjectId : name === 'grade_level_subjects' ? s.classSubjects.gradeLevelSubjectId : s.classGroups.gradeLevelId
    return exists(relation, schoolId, and(sql`${foreign} = ${value('id')}`, targetPredicate(relation, target, schoolId, year, seen))!)
  }
  if (name === 'fees') return exists(s.studentFees, schoolId, and(sql`${s.studentFees.feeId} = ${value('id')}`, targetPredicate(s.studentFees, target, schoolId, year, seen))!)
  const paths = (parents[name] ?? []).map(([field, parent]) => via(field, parent))
  return paths.length ? or(...paths)! : sql`false`
}

function yearPredicate(table: PgTable, year: string, schoolId: string, visited: Set<string>, proposed?: Record<string, unknown>): SQL {
  const name = getTableName(table)
  if (visited.has(name)) return sql`false`
  const seen = new Set([...visited, name])
  const columns = getTableColumns(table)
  const value = values(table, proposed)
  if (name === 'academic_years') return sql`${value('id')} = ${year}`
  if (columns['academicYearId']) return sql`${value('academicYearId')} = ${year}`
  const via = (field: string, parent: PgTable) => exists(parent, schoolId,
    and(sql`${getTableColumns(parent)['id']!} = ${value(field)}`, yearPredicate(parent, year, schoolId, seen))!)
  if (columns['classGroupId']) return via('classGroupId', s.classGroups)
  if (columns['classSubjectId']) return via('classSubjectId', s.classSubjects)
  if (columns['periodId']) return via('periodId', s.academicPeriods)
  if (name === 'assessment_results' || name === 'attendance_records')
    return or(...parents[name]!.map(([field, parent]) => via(field, parent)))!
  if (name === 'students') return exists(s.studentClassEnrollments, schoolId,
    and(sql`${s.studentClassEnrollments.studentId} = ${value('id')}`, activeEnrollment(year))!)
  if (columns['studentId']) return via('studentId', s.students)
  const paths = (parents[name] ?? []).map(([field, parent]) => via(field, parent))
  // Non-academic reference/profile records are school-owned across years.
  return paths.length ? or(...paths)! : sql`true`
}

function publicationPredicate(table: PgTable, schoolId: string, value: (field: string) => SQLWrapper): SQL {
  const name = getTableName(table)
  if (name === 'report_card_results' || name === 'report_card_definitions' || name === 'announcements') return sql`${value('status')} = 'published'`
  if (name === 'assessment_results') return exists(s.assessments, schoolId,
    and(sql`${s.assessments.id} = ${value('assessmentId')}`, exists(s.reportCardResults, schoolId,
      and(sql`${s.reportCardResults.studentId} = ${value('studentId')}`, eq(s.reportCardResults.periodId, s.assessments.periodId), eq(s.reportCardResults.status, 'published'))!))!)
  return sql`false`
}
