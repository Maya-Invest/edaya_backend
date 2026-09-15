import type { CoreEntityKey, ResourceAccessClause } from '@edaya/core'
import type { AccessFacts } from './facts'
import { AttachmentOwnerKind as Owner, Permission as P, ReportCardDefinitionStatus } from '@edaya/core'

const teacherReads = new Set([
  P.QUERY_COMMUNICATIONS_READ,
  P.QUERY_CALENDAR_READ,
  P.QUERY_WORKSPACE_READ,
  P.STUDENT_READ,
  P.QUERY_STUDENT_DIRECTORY_READ,
  P.QUERY_STUDENT_DETAIL_READ,
  P.ENROLLMENT_READ,
  P.QUERY_ENROLLMENT_HISTORY_READ,
  P.ACADEMIC_PROGRAM_READ,
  P.QUERY_CLASS_DIRECTORY_READ,
  P.QUERY_CLASS_CURRICULUM_READ,
  P.QUERY_CURRICULUM_PROGRESS_READ,
  P.GRADE_READ,
  P.EXAM_CONFIG_READ,
  P.CLASS_LOGBOOK_READ,
  P.ATTENDANCE_READ,
  P.QUERY_ATTENDANCE_READ,
  P.QUERY_TIMETABLE_READ,
  P.TIMETABLE_READ,
  P.REPORT_CARD_READ,
  P.QUERY_REPORT_CARD_DETAIL_READ,
  P.DISCIPLINE_READ,
  P.ATTACHMENT_READ,
])
const teacherWrites = new Set([P.GRADE_INPUT, P.GRADE_UPDATE, P.EXAM_CONFIG_CREATE, P.EXAM_CONFIG_UPDATE, P.CLASS_LOGBOOK_CREATE, P.CLASS_LOGBOOK_UPDATE, P.ATTENDANCE_RECORD, P.DISCIPLINE_CREATE, P.REPORT_CARD_PUBLISH])
const familyReads = new Set([
  P.QUERY_WORKSPACE_READ,
  P.STUDENT_READ,
  P.QUERY_STUDENT_DIRECTORY_READ,
  P.QUERY_STUDENT_DETAIL_READ,
  P.ENROLLMENT_READ,
  P.QUERY_ENROLLMENT_HISTORY_READ,
  P.ACADEMIC_PROGRAM_READ,
  P.QUERY_CLASS_DIRECTORY_READ,
  P.QUERY_CLASS_CURRICULUM_READ,
  P.QUERY_CURRICULUM_PROGRESS_READ,
  P.GRADE_READ,
  P.EXAM_CONFIG_READ,
  P.CLASS_LOGBOOK_READ,
  P.ATTENDANCE_READ,
  P.QUERY_ATTENDANCE_READ,
  P.QUERY_TIMETABLE_READ,
  P.TIMETABLE_READ,
  P.REPORT_CARD_READ,
  P.QUERY_REPORT_CARD_DETAIL_READ,
  P.ATTACHMENT_READ,
  P.PAYMENT_READ,
  P.FINANCIAL_CONFIG_READ,
  P.QUERY_CALENDAR_READ,
  P.QUERY_COMMUNICATIONS_READ,
])
const referenceResources = new Set<CoreEntityKey>(['schools', 'academicYears', 'academicPeriods', 'periodDefinitions', 'gradeScales'])
const classResources = new Set<CoreEntityKey>([
  'classGroups',
  'classSubjects',
  'classSubjectMatters',
  'classSubjectProgress',
  'subjects',
  'subjectMatters',
  'gradeLevels',
  'gradeLevelSubjects',
  'gradeLevelSubjectMatters',
  'schedules',
  'lessonSessions',
  'activitySessions',
  'attendances',
  'activities',
  'classActivityEnrollments',
  'calendarEvents',
])
const teacherResources = new Set<CoreEntityKey>([
  ...classResources,
  'students',
  'enrollments',
  'assessments',
  'assessmentResults',
  'results',
  'definitions',
  'sections',
  'attendance',
  'incidents',
  'studentIncidentInvolvements',
  'studentDisciplinaryActions',
  'attachments',
])
const familyResources = new Set<CoreEntityKey>([
  ...classResources,
  'students',
  'enrollments',
  'assessments',
  'assessmentResults',
  'results',
  'definitions',
  'sections',
  'attendance',
  'catalogServices',
  'studentServiceEnrollments',
  'studentCharges',
  'studentYearAccounts',
  'payments',
  'attachments',
  'activityEnrollments',
  'studentPhotoSubmissions',
])

/** An admitted read with no current relationships returns an empty SQL result. */
function visibleRows(clauses: ResourceAccessClause[]): ResourceAccessClause[] {
  return clauses.length ? clauses : [{ target: { kind: 'records', ids: [] } }]
}

export async function teacherPolicy(facts: AccessFacts, action: P, resource: CoreEntityKey | undefined, intent: 'read' | 'write'): Promise<ResourceAccessClause[]> {
  const actor = facts.actor
  if (actor.kind !== 'teacher')
    return []
  if (intent === 'read' && (resource === 'teachers' || resource === 'teacherAssignments' || resource === 'teacherUnavailabilities')
    && [P.STAFF_READ, P.ACCESS_CONTROL_READ].includes(action)) {
    const ids = resource === 'teachers' ? [actor.teacherId] : (await facts.list(resource, { teacherId: actor.teacherId })).map(row => row.id)
    return [{ target: { kind: 'records', ids } }]
  }
  if (!(intent === 'read' ? teacherReads : teacherWrites).has(action))
    return []
  if (intent === 'read' && resource !== undefined && referenceResources.has(resource))
    return [{ target: { kind: 'school' } }]
  const teaching = await facts.teaching()
  if (action === P.QUERY_COMMUNICATIONS_READ && intent === 'read') {
    if (resource === 'messageDeliveries')
      return [{ target: { kind: 'recipient', actorKind: actor.kind, actorId: actor.actorId, subjectId: actor.subjectId } }]
    if (resource === 'announcements' || resource === 'announcementTargets')
      return [{ target: await facts.communicationAudience(actor.kind, actor.actorId) }]
  }
  if (resource !== undefined && !teacherResources.has(resource))
    return []
  const subjectClauses: ResourceAccessClause[] = teaching.subjects.map(subject => ({ target: { kind: 'class_subject', ...subject }, academicYearId: teaching.year }))
  const homeroomClauses: ResourceAccessClause[] = teaching.homerooms.map(classGroupId => ({ target: { kind: 'class_group', classGroupId }, academicYearId: teaching.year }))
  if (intent === 'read') {
    if ([P.CLASS_LOGBOOK_READ, P.QUERY_CURRICULUM_PROGRESS_READ].includes(action))
      return visibleRows(subjectClauses)
    if (resource === 'attachments') {
      return visibleRows([...subjectClauses, ...homeroomClauses].map(clause => ({
        ...clause,
        attachmentOwners: [Owner.Student, Owner.StudentClassEnrollment, Owner.AttendanceRecord, Owner.AssessmentResult, Owner.ReportCard, Owner.Incident, Owner.StudentDisciplinaryAction],
      })))
    }
    if (resource === 'activitySessions' || resource === 'activities' || resource === 'classActivityEnrollments')
      return visibleRows(homeroomClauses)
    return visibleRows([...subjectClauses, ...homeroomClauses])
  }
  switch (action) {
    case P.GRADE_INPUT:
    case P.GRADE_UPDATE:
    case P.EXAM_CONFIG_CREATE:
    case P.EXAM_CONFIG_UPDATE:
      return (resource === undefined || ['assessments', 'assessmentResults', 'students', 'classGroups', 'classSubjects'].includes(resource)) ? subjectClauses : []
    case P.CLASS_LOGBOOK_CREATE:
    case P.CLASS_LOGBOOK_UPDATE:
      return (resource === undefined || ['lessonSessions', 'classSubjectProgress', 'classSubjectMatters', 'classGroups', 'classSubjects'].includes(resource)) ? subjectClauses : []
    case P.ATTENDANCE_RECORD:
      if (resource === undefined || resource === 'attendance') {
        return [
          ...subjectClauses.map(clause => ({ ...clause, attendanceMode: 'session' as const })),
          ...homeroomClauses.map(clause => ({ ...clause, attendanceMode: 'daily' as const })),
        ]
      }
      if (resource === 'attendances')
        return homeroomClauses
      if (resource === 'lessonSessions' || resource === 'assessments' || resource === 'classSubjects')
        return subjectClauses
      return resource === 'students' || resource === 'classGroups' ? [...subjectClauses, ...homeroomClauses] : []
    case P.DISCIPLINE_CREATE:
      return (resource === undefined || ['incidents', 'studentIncidentInvolvements', 'students', 'classGroups', 'lessonSessions'].includes(resource)) ? [...subjectClauses, ...homeroomClauses] : []
    case P.REPORT_CARD_PUBLISH:
      return resource === undefined || resource === 'results' ? [...subjectClauses, ...homeroomClauses] : []
    default: return []
  }
}

export async function familyPolicy(facts: AccessFacts, action: P, resource: CoreEntityKey | undefined, intent: 'read' | 'write'): Promise<ResourceAccessClause[]> {
  const actor = facts.actor
  if (actor.kind !== 'guardian' && actor.kind !== 'student')
    return []
  if (intent === 'write') {
    if (actor.kind !== 'guardian' || action !== P.PARENT_UPDATE)
      return []
    if (resource === 'guardians')
      return [{ target: { kind: 'records', ids: [actor.guardianId] } }]
    if (resource === 'guardianLinks')
      return [{ target: { kind: 'records', ids: (await facts.list('guardianLinks', { guardianId: actor.guardianId })).map(link => link.id) } }]
    if (resource === 'studentPhotoSubmissions') {
      const studentIds = await facts.linkedStudents()
      return visibleRows(studentIds.map(studentId => ({ target: { kind: 'student' as const, studentId } })))
    }
    return []
  }
  if (actor.kind === 'guardian' && (resource === 'guardians' || resource === 'guardianLinks')
    && [P.QUERY_GUARDIAN_STUDENTS_ADMIN_READ, P.QUERY_GUARDIAN_SELF_READ, P.QUERY_WORKSPACE_READ, P.QUERY_COMMUNICATIONS_READ].includes(action)) {
    return [{ target: { kind: 'records', ids: resource === 'guardians' ? [actor.guardianId] : (await facts.list('guardianLinks', { guardianId: actor.guardianId })).map(link => link.id) } }]
  }
  if (!familyReads.has(action))
    return []
  if (resource !== undefined && referenceResources.has(resource))
    return [{ target: { kind: 'school' } }]
  const studentIds = await facts.linkedStudents()
  if (action === P.QUERY_COMMUNICATIONS_READ) {
    if (resource === 'messageDeliveries')
      return [{ target: { kind: 'recipient', actorKind: actor.kind, actorId: actor.actorId, subjectId: actor.subjectId } }]
    if (resource === 'announcements' || resource === 'announcementTargets') {
      return [{ target: await facts.communicationAudience(actor.kind, actor.actorId) }]
    }
  }
  if (resource !== undefined && !familyResources.has(resource))
    return []
  if (resource === 'sections') {
    const definitions = await facts.repository('definitions').list({ status: ReportCardDefinitionStatus.Published })
    const rows = await facts.repository('sections').list({ reportCardDefinitionId: { $in: definitions.map(row => row.id) } })
    return [{ target: { kind: 'records', ids: rows.map(row => row.id) } }]
  }
  if (resource === 'definitions')
    return [{ target: { kind: 'school' }, publishedOnly: true }]
  const academicYearId = await facts.academicYear()
  if (!academicYearId && resource !== undefined && resource !== 'students' && resource !== 'attachments' && resource !== 'studentPhotoSubmissions')
    return visibleRows([])
  if (resource === 'attachments') {
    const ownProfile: ResourceAccessClause[] = actor.kind === 'guardian' ? [{ target: { kind: 'records', ids: [actor.guardianId] }, attachmentOwners: [Owner.Guardian] }] : []
    return visibleRows([...ownProfile, ...studentIds.flatMap(studentId => [
      { target: { kind: 'student' as const, studentId }, academicYearId, attachmentOwners: [Owner.Student, Owner.StudentClassEnrollment, Owner.AttendanceRecord, Owner.Payment] },
      { target: { kind: 'student' as const, studentId }, academicYearId, attachmentOwners: [Owner.AssessmentResult, Owner.ReportCard], publishedOnly: true },
    ])])
  }
  const publishedOnly = resource === 'results' || resource === 'assessmentResults'
  return visibleRows(studentIds.map(studentId => ({ target: { kind: 'student', studentId }, academicYearId, ...(publishedOnly ? { publishedOnly: true } : {}) })))
}
