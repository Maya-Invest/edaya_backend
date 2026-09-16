/* eslint dot-notation: "off" -- Dynamic table columns require bracket access under noPropertyAccessFromIndexSignature. */
import type { AccessTarget, AuthorityScope, CoreEntityKey, GrantScope, ResourceAccessClause, ResourceAccessScope } from '@edaya/core'
import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { ActivityEnrollmentStatus, AttachmentOwnerKind } from '@edaya/core'
import { and, eq, getTableColumns, getTableName, inArray, or, sql } from 'drizzle-orm'
import * as s from '../postgres-schema'
import { schoolScope } from './school-scope'

const tables: Record<CoreEntityKey, PgTable> = {
  schools: s.schools,
  academicYears: s.academicYears,
  academicPeriods: s.academicPeriods,
  periodDefinitions: s.periodDefinitions,
  gradeLevels: s.gradeLevels,
  staffMembers: s.staffMembers,
  staffAssignments: s.staffAssignments,
  teachers: s.teachers,
  teacherAssignments: s.teacherAssignments,
  teacherUnavailabilities: s.teacherUnavailabilities,
  accountInvitations: s.accountInvitations,
  staffPermissionAssignments: s.staffPermissionAssignments,
  staffPermissionProfiles: s.staffPermissionProfiles,
  staffPermissionProfileBindings: s.staffPermissionProfileBindings,
  attachments: s.attachments,
  resources: s.resources,
  resourceAssignments: s.resourceAssignments,
  catalogServices: s.catalogServices,
  studentServiceEnrollments: s.studentServiceEnrollments,
  studentCharges: s.studentCharges,
  studentYearAccounts: s.studentYearAccounts,
  payments: s.payments,
  schedules: s.schedules,
  lessonSessions: s.lessonSessions,
  activitySessions: s.activitySessions,
  attendances: s.attendances,
  calendarEvents: s.calendarEvents,
  attendance: s.attendanceRecords,
  announcements: s.announcements,
  announcementTargets: s.announcementTargets,
  messageDeliveries: s.messageDeliveries,
  schoolNotificationTemplates: s.schoolNotificationTemplates,
  subjects: s.subjects,
  subjectMatters: s.subjectMatters,
  gradeLevelSubjects: s.gradeLevelSubjects,
  gradeLevelSubjectMatters: s.gradeLevelSubjectMatters,
  classGroups: s.classGroups,
  classSubjects: s.classSubjects,
  classSubjectMatters: s.classSubjectMatters,
  classSubjectProgress: s.classSubjectProgress,
  activities: s.activities,
  activityEnrollments: s.activityEnrollments,
  classActivityEnrollments: s.classActivityEnrollments,
  assessments: s.assessments,
  assessmentResults: s.assessmentResults,
  gradeScales: s.gradeScales,
  definitions: s.reportCardDefinitions,
  sections: s.reportCardDefinitionSections,
  results: s.reportCardResults,
  students: s.students,
  enrollments: s.studentClassEnrollments,
  guardians: s.guardians,
  guardianLinks: s.guardianStudentLinks,
  studentNotes: s.studentNotes,
  studentPhotoSubmissions: s.studentPhotoSubmissions,
  studentHealthProfiles: s.studentHealthProfiles,
  studentDisciplinaryActions: s.studentDisciplinaryActions,
  disciplinaryActions: s.disciplinaryActions,
  studentIncidentInvolvements: s.studentIncidentInvolvements,
  incidents: s.incidents,
  documentIssuances: s.documentIssuances,
}

const parents: Record<string, readonly [string, PgTable][]> = {
  payments: [['accountId', s.studentYearAccounts]],
  assessment_results: [['assessmentId', s.assessments]],
  report_card_definition_sections: [['reportCardDefinitionId', s.reportCardDefinitions]],
  class_subject_matters: [['classSubjectId', s.classSubjects]],
  class_subject_progress: [['classSubjectMatterId', s.classSubjectMatters]],
  subject_matters: [['subjectId', s.subjects]],
  grade_level_subject_matters: [['gradeLevelSubjectId', s.gradeLevelSubjects]],
  incidents: [['lessonSessionId', s.lessonSessions]],
  student_incident_involvements: [['incidentId', s.incidents]],
  student_disciplinary_actions: [['incidentId', s.incidents]],
  attendance_records: [['attendanceId', s.attendances], ['lessonSessionId', s.lessonSessions], ['activitySessionId', s.activitySessions], ['assessmentId', s.assessments]],
  staff_assignments: [['classSubjectId', s.classSubjects], ['lessonSessionId', s.lessonSessions], ['activitySessionId', s.activitySessions], ['assessmentId', s.assessments]],
  resource_assignments: [['lessonSessionId', s.lessonSessions], ['activitySessionId', s.activitySessions], ['assessmentId', s.assessments]],
  announcement_targets: [['announcementId', s.announcements]],
}

// Optional placements describe one record, not alternative routes to authority.
// Every supplied placement must match; a missing class ID may be resolved by its occurrence.
const optionalPlacements: Record<string, Array<[string, PgTable]>> = {
  incidents: [['classGroupId', s.classGroups], ['lessonSessionId', s.lessonSessions]],
  resource_assignments: [['classGroupId', s.classGroups], ['lessonSessionId', s.lessonSessions], ['activitySessionId', s.activitySessions], ['assessmentId', s.assessments]],
}

const attachmentOwners: Partial<Record<AttachmentOwnerKind, PgTable>> = {
  [AttachmentOwnerKind.Student]: s.students,
  [AttachmentOwnerKind.Guardian]: s.guardians,
  [AttachmentOwnerKind.Staff]: s.staffMembers,
  [AttachmentOwnerKind.StudentHealthProfile]: s.studentHealthProfiles,
  [AttachmentOwnerKind.StudentClassEnrollment]: s.studentClassEnrollments,
  [AttachmentOwnerKind.AttendanceRecord]: s.attendanceRecords,
  [AttachmentOwnerKind.Incident]: s.incidents,
  [AttachmentOwnerKind.StudentDisciplinaryAction]: s.studentDisciplinaryActions,
  [AttachmentOwnerKind.AssessmentResult]: s.assessmentResults,
  [AttachmentOwnerKind.ReportCard]: s.reportCardResults,
  [AttachmentOwnerKind.Payment]: s.payments,
  [AttachmentOwnerKind.School]: s.schools,
  [AttachmentOwnerKind.DocumentIssuance]: s.documentIssuances,
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
  if (getTableName(table) === 'attachments') {
    const owners = clause.attachmentOwners ?? Object.values(AttachmentOwnerKind)
    const paths = owners.flatMap((kind) => {
      const owner = attachmentOwners[kind]
      if (!owner)
        return []
      return [and(sql`${value('ownerKind')} = ${kind}`, exists(owner, schoolId, and(sql`${getTableColumns(owner)['id']!} = ${value('ownerId')}`, compileClause(owner, { ...clause, attachmentOwners: undefined }, schoolId))!))!]
    })
    return paths.length && clause.attachmentPurposes?.length
      ? and(
        or(...paths),
        or(...clause.attachmentPurposes.map(purpose => sql`${value('purpose')} = ${purpose}`)),
        clause.attachmentIds
          ? (clause.attachmentIds.length
              ? sql`${value('id')} in (${sql.join(clause.attachmentIds.map(id => sql`${id}`), sql`, `)})`
              : sql`false`)
          : undefined,
      )!
      : sql`false`
  }
  return and(
    getTableName(table) === 'calendar_events' && clause.calendarAncestors
      ? calendarAudiencePredicate(table, clause.target, schoolId, clause.academicYearId, proposed)
      : targetPredicate(table, clause.target, schoolId, clause.academicYearId, new Set(), proposed),
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

function announcementAudienceTargets(target: Extract<AccessTarget, { kind: 'audience' }>, schoolId: string): SQL {
  const targets: SQL[] = [eq(s.announcementTargets.targetKind, 'school')]
  if (target.actorKind !== 'teacher') {
    const broadcast = { staff: 'all_staff', guardian: 'all_guardians', student: 'all_students' }[target.actorKind]
    targets.push(eq(s.announcementTargets.targetKind, broadcast))
    targets.push(and(eq(s.announcementTargets.targetKind, target.actorKind === 'staff' ? 'staff_member' : target.actorKind), eq(s.announcementTargets.targetId, target.actorId))!)
  }
  if (target.classGroupIds.length) {
    targets.push(and(eq(s.announcementTargets.targetKind, 'class_group'), inArray(s.announcementTargets.targetId, [...target.classGroupIds]))!)
    targets.push(and(eq(s.announcementTargets.targetKind, 'grade_level'), exists(s.classGroups, schoolId, and(
      inArray(s.classGroups.id, [...target.classGroupIds]),
      eq(s.classGroups.gradeLevelId, s.announcementTargets.targetId),
    )!))!)
  }
  return or(...targets)!
}

function calendarAudiencePredicate(table: PgTable, target: AccessTarget, schoolId: string, year?: string, proposed?: Record<string, unknown>): SQL {
  if (target.kind === 'records' || target.kind === 'recipient' || target.kind === 'audience')
    return targetPredicate(table, target, schoolId, year, new Set(), proposed)
  if (target.kind === 'school')
    return sql`true`
  const value = values(table, proposed)
  const visibleClasses = targetPredicate(s.classGroups, target, schoolId, year, new Set())
  return or(
    sql`${value('scopeKind')} = 'school'`,
    exists(s.classGroups, schoolId, and(
      visibleClasses,
      year ? eq(s.classGroups.academicYearId, year) : undefined,
      or(
        and(sql`${value('scopeKind')} = 'class_group'`, sql`${s.classGroups.id} = ${value('scopeId')}`),
        and(sql`${value('scopeKind')} = 'grade_level'`, sql`${s.classGroups.gradeLevelId} = ${value('scopeId')}`),
      ),
    )!),
  )!
}

// An all-grain grant becomes a pattern without identifiers. It still has to reach
// that grain through tenant-bound relationships; it is not school authority.
type GrantPattern<T = GrantScope> = T extends { kind: string }
  ? Pick<T, 'kind'> & Partial<Omit<T, 'kind'>> : never
type TargetPattern = Exclude<AccessTarget, GrantScope> | GrantPattern

function targetPredicate(table: PgTable, target: TargetPattern, schoolId: string, year: string | undefined, visited: Set<string>, proposed?: Record<string, unknown>): SQL {
  if (target.kind === 'all') {
    if (!target.grain)
      throw new Error('All scope requires a grain')
    return targetPredicate(table, { kind: target.grain }, schoolId, year, visited, proposed)
  }
  const name = getTableName(table)
  if (visited.has(name))
    return sql`false`
  const seen = new Set([...visited, name])
  const columns = getTableColumns(table)
  const value = values(table, proposed)
  const matches = (field: string, id: string | undefined): SQL => id === undefined ? sql`${value(field)} is not null` : sql`${value(field)} = ${id}`
  const via = (field: string, parent: PgTable): SQL => exists(parent, schoolId, and(sql`${getTableColumns(parent)['id']!} = ${value(field)}`, targetPredicate(parent, target, schoolId, year, seen))!)

  if (['student_incident_involvements', 'student_disciplinary_actions'].includes(name)
    && !['school', 'records', 'recipient', 'audience'].includes(target.kind)) {
    return and(via('studentId', s.students), via('incidentId', s.incidents))!
  }
  if (target.kind === 'lesson_session' || target.kind === 'activity_session' || target.kind === 'assessment')
    return occurrencePredicate(table, target, schoolId, year, visited, proposed)
  if (target.kind === 'school')
    return sql`true`
  if (target.kind === 'records')
    return target.ids.length ? sql`${value('id')} in (${sql.join(target.ids.map(id => sql`${id}`), sql`, `)})` : sql`false`
  if (target.kind === 'recipient') {
    return name === 'message_deliveries'
      ? and(matches('recipientKind', target.actorKind), matches('recipientId', target.actorId), matches('subjectId', target.subjectId))!
      : sql`false`
  }
  if (target.kind === 'audience') {
    if (name === 'announcement_targets')
      return and(announcementAudienceTargets(target, schoolId), via('announcementId', s.announcements))!
    if (name !== 'announcements')
      return sql`false`
    return and(sql`${value('status')} = 'published'`, sql`(${value('expiresAt')} is null or ${value('expiresAt')} > now())`, sql`exists (select 1 from ${s.announcementTargets} where ${s.announcementTargets.announcementId} = ${value('id')} and ${announcementAudienceTargets(target, schoolId)})`)!
  }

  const placements = optionalPlacements[name]
  if (placements) {
    return and(
      or(...placements.map(([field]) => sql`${value(field)} is not null`)),
      ...placements.map(([field, parent]) => or(sql`${value(field)} is null`, via(field, parent))),
    )!
  }

  if (name === 'calendar_events') {
    // Mutations affect only the selected placement, never its school/grade ancestors.
    if (target.kind === 'class_group')
      return and(sql`${value('scopeKind')} = 'class_group'`, matches('scopeId', target.classGroupId))!
    if (target.kind === 'grade_level')
      return and(sql`${value('scopeKind')} = 'grade_level'`, matches('scopeId', target.gradeLevelId))!
    return sql`false`
  }

  if (target.kind === 'student') {
    if (name === 'students')
      return matches('id', target.studentId)
    if (columns['studentId'])
      return matches('studentId', target.studentId)
    if (name === 'guardians')
      return exists(s.guardianStudentLinks, schoolId, and(sql`${s.guardianStudentLinks.guardianId} = ${value('id')}`, target.studentId ? eq(s.guardianStudentLinks.studentId, target.studentId) : sql`true`)!)
    if (name === 'class_groups' || columns['classGroupId']) {
      const classId = name === 'class_groups' ? value('id') : value('classGroupId')
      return exists(s.studentClassEnrollments, schoolId, and(sql`${s.studentClassEnrollments.classGroupId} = ${classId}`, target.studentId ? eq(s.studentClassEnrollments.studentId, target.studentId) : sql`true`, activeEnrollment(year))!)
    }
    if (name === 'catalog_services')
      return exists(s.studentServiceEnrollments, schoolId, and(sql`${s.studentServiceEnrollments.catalogServiceId} = ${value('id')}`, target.studentId ? eq(s.studentServiceEnrollments.studentId, target.studentId) : sql`true`)!)
    if (name === 'activities')
      return exists(s.activityEnrollments, schoolId, and(sql`${s.activityEnrollments.activityId} = ${value('id')}`, target.studentId ? eq(s.activityEnrollments.studentId, target.studentId) : sql`true`, eq(s.activityEnrollments.status, ActivityEnrollmentStatus.Approved))!)
  }

  if (target.kind === 'class_group') {
    if (name === 'activities') {
      const availableClass = exists(s.classGroups, schoolId, and(
        target.classGroupId ? eq(s.classGroups.id, target.classGroupId) : sql`true`,
        year ? eq(s.classGroups.academicYearId, year) : undefined,
      )!)
      const assignedClass = exists(s.classActivityEnrollments, schoolId, and(
        sql`${s.classActivityEnrollments.activityId} = ${value('id')}`,
        targetPredicate(s.classActivityEnrollments, target, schoolId, year, seen),
        year ? yearPredicate(s.classActivityEnrollments, year, schoolId, new Set()) : undefined,
      )!)
      const schoolWide = sql`not exists (select 1 from ${s.classActivityEnrollments} where ${s.classActivityEnrollments.activityId} = ${value('id')})`
      return and(availableClass, or(assignedClass, schoolWide))!
    }
    if (name === 'class_groups')
      return matches('id', target.classGroupId)
    if (columns['classGroupId'])
      return matches('classGroupId', target.classGroupId)
  }
  if (target.kind === 'class_subject') {
    if (name === 'class_subjects')
      return and(matches('classGroupId', target.classGroupId), target.classSubjectId ? matches('id', target.classSubjectId) : undefined)!
    if (columns['classSubjectId'])
      return via('classSubjectId', s.classSubjects)
    if (name === 'class_groups')
      return matches('id', target.classGroupId)
    // Class-wide resources are admitted only when the business policy selects them.
    if (columns['classGroupId'])
      return matches('classGroupId', target.classGroupId)
  }
  if (target.kind === 'grade_level' || target.kind === 'grade_level_subject') {
    if (name === 'grade_levels')
      return matches('id', target.gradeLevelId)
    if (name === 'grade_level_subjects') {
      return and(matches('gradeLevelId', target.gradeLevelId), target.kind === 'grade_level_subject' && target.gradeLevelSubjectId ? matches('id', target.gradeLevelSubjectId) : undefined)!
    }
    if (target.kind === 'grade_level_subject' && columns['gradeLevelSubjectId'])
      return via('gradeLevelSubjectId', s.gradeLevelSubjects)
    if (columns['gradeLevelId'])
      return matches('gradeLevelId', target.gradeLevelId)
  }
  if (target.kind === 'activity') {
    if (name === 'activities')
      return matches('id', target.activityId)
    if (columns['activityId']) {
      return and(matches('activityId', target.activityId), target.classGroupId ? (columns['classGroupId'] ? matches('classGroupId', target.classGroupId) : sql`false`) : undefined)!
    }
  }

  if (name === 'students') {
    return exists(s.studentClassEnrollments, schoolId, and(sql`${s.studentClassEnrollments.studentId} = ${value('id')}`, activeEnrollment(year), targetPredicate(s.studentClassEnrollments, target, schoolId, year, seen))!)
  }
  if (['assessment_results', 'attendance_records'].includes(name)) {
    const paths = (parents[name] ?? []).map(([field, parent]) => via(field, parent))
    return paths.length ? or(...paths)! : sql`false`
  }
  if (columns['studentId'])
    return via('studentId', s.students)
  if (name === 'guardians') {
    return exists(s.guardianStudentLinks, schoolId, and(sql`${s.guardianStudentLinks.guardianId} = ${value('id')}`, targetPredicate(s.guardianStudentLinks, target, schoolId, year, seen))!)
  }
  if (name === 'class_groups' && target.kind === 'activity') {
    return exists(s.classActivityEnrollments, schoolId, and(sql`${s.classActivityEnrollments.classGroupId} = ${value('id')}`, target.activityId ? eq(s.classActivityEnrollments.activityId, target.activityId) : sql`true`)!)
  }
  if (columns['classGroupId'])
    return via('classGroupId', s.classGroups)
  if (columns['classSubjectId'])
    return via('classSubjectId', s.classSubjects)
  if (name === 'subjects' || name === 'grade_level_subjects' || name === 'grade_levels') {
    const relation = name === 'grade_levels' ? s.classGroups : s.classSubjects
    const foreign = name === 'subjects' ? s.classSubjects.subjectId : name === 'grade_level_subjects' ? s.classSubjects.gradeLevelSubjectId : s.classGroups.gradeLevelId
    return exists(relation, schoolId, and(sql`${foreign} = ${value('id')}`, targetPredicate(relation, target, schoolId, year, seen))!)
  }
  if (name === 'catalog_services')
    return exists(s.studentServiceEnrollments, schoolId, and(sql`${s.studentServiceEnrollments.catalogServiceId} = ${value('id')}`, targetPredicate(s.studentServiceEnrollments, target, schoolId, year, seen))!)
  const paths = (parents[name] ?? []).map(([field, parent]) => via(field, parent))
  return paths.length ? or(...paths)! : sql`false`
}

type OccurrenceTarget = Extract<AuthorityScope, { kind: 'lesson_session' | 'activity_session' | 'assessment' }>

function occurrencePredicate(table: PgTable, target: OccurrenceTarget, schoolId: string, year: string | undefined, visited: Set<string>, proposed?: Record<string, unknown>): SQL {
  const name = getTableName(table)
  const value = values(table, proposed)
  const seen = new Set([...visited, name])
  const column = target.kind === 'lesson_session' ? 'lessonSessionId' : target.kind === 'activity_session' ? 'activitySessionId' : 'assessmentId'
  const id = target.kind === 'lesson_session' ? target.lessonSessionId : target.kind === 'activity_session' ? target.activitySessionId : target.assessmentId
  const ownTable = target.kind === 'lesson_session' ? 'lesson_sessions' : target.kind === 'activity_session' ? 'activity_sessions' : 'assessments'
  if (name === ownTable)
    return sql`${value('id')} = ${id}`
  const paths: SQL[] = []
  if (getTableColumns(table)[column])
    paths.push(sql`${value(column)} = ${id}`)
  for (const [field, parent] of parents[name] ?? []) {
    if (!seen.has(getTableName(parent)))
      paths.push(exists(parent, schoolId, and(sql`${getTableColumns(parent)['id']!} = ${value(field)}`, targetPredicate(parent, target, schoolId, year, seen))!))
  }
  if (paths.length)
    return or(...paths)!
  // Placement references may be read/checked as part of this occurrence's action.
  // Transactional records never inherit this wider reference scope.
  if (['students', 'student_class_enrollments', 'class_groups', 'class_subjects', 'class_subject_matters', 'subjects', 'subject_matters', 'grade_levels', 'grade_level_subjects', 'grade_level_subject_matters'].includes(name)) {
    const placement: AuthorityScope = 'classSubjectId' in target
      ? { kind: 'class_subject', classGroupId: target.classGroupId, classSubjectId: target.classSubjectId }
      : { kind: 'class_group', classGroupId: target.classGroupId }
    return targetPredicate(table, placement, schoolId, year, visited, proposed)
  }
  return sql`false`
}

function yearPredicate(table: PgTable, year: string, schoolId: string, visited: Set<string>, proposed?: Record<string, unknown>): SQL {
  const name = getTableName(table)
  if (visited.has(name))
    return sql`false`
  const seen = new Set([...visited, name])
  const columns = getTableColumns(table)
  const value = values(table, proposed)
  if (name === 'academic_years')
    return sql`${value('id')} = ${year}`
  if (columns['academicYearId'])
    return sql`${value('academicYearId')} = ${year}`
  const via = (field: string, parent: PgTable) => exists(parent, schoolId, and(sql`${getTableColumns(parent)['id']!} = ${value(field)}`, yearPredicate(parent, year, schoolId, seen))!)
  if (['student_incident_involvements', 'student_disciplinary_actions'].includes(name))
    return via('incidentId', s.incidents)
  const placements = optionalPlacements[name]
  if (placements)
    return and(...placements.map(([field, parent]) => or(sql`${value(field)} is null`, via(field, parent))))!
  if (columns['classGroupId'])
    return via('classGroupId', s.classGroups)
  if (columns['classSubjectId'])
    return via('classSubjectId', s.classSubjects)
  if (columns['periodId'])
    return via('periodId', s.academicPeriods)
  if (name === 'assessment_results' || name === 'attendance_records')
    return or(...parents[name]!.map(([field, parent]) => via(field, parent)))!
  // Profiles exist before enrollment and remain visible to their granted action after it ends.
  // Class/subject scope matching separately requires a current enrollment in targetPredicate.
  if (name === 'students')
    return sql`true`
  if (columns['studentId'])
    return via('studentId', s.students)
  const paths = (parents[name] ?? []).map(([field, parent]) => via(field, parent))
  // Non-academic reference/profile records are school-owned across years.
  return paths.length ? or(...paths)! : sql`true`
}

function publicationPredicate(table: PgTable, schoolId: string, value: (field: string) => SQLWrapper): SQL {
  const name = getTableName(table)
  if (name === 'report_card_results' || name === 'report_card_definitions' || name === 'announcements')
    return sql`${value('status')} = 'published'`
  if (name === 'assessment_results') {
    return exists(s.assessments, schoolId, and(sql`${s.assessments.id} = ${value('assessmentId')}`, exists(s.reportCardResults, schoolId, and(sql`${s.reportCardResults.studentId} = ${value('studentId')}`, eq(s.reportCardResults.periodId, s.assessments.periodId), eq(s.reportCardResults.status, 'published'))!))!)
  }
  return sql`false`
}
