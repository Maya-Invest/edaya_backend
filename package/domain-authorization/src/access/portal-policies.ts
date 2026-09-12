import type { CoreEntityKey, ResourceAccessClause } from '@edaya/core';
import type { AccessFacts } from './facts';
import { Permission as P, ReportCardDefinitionStatus } from '@edaya/core';

const teacherReads = new Set([
  P.QUERY_WORKSPACE_READ, P.STUDENT_READ, P.QUERY_STUDENT_DIRECTORY_READ, P.QUERY_STUDENT_DETAIL_READ,
  P.ENROLLMENT_READ, P.QUERY_ENROLLMENT_HISTORY_READ, P.ACADEMIC_PROGRAM_READ, P.QUERY_CLASS_DIRECTORY_READ,
  P.QUERY_CLASS_CURRICULUM_READ, P.QUERY_CURRICULUM_PROGRESS_READ, P.GRADE_READ, P.EXAM_CONFIG_READ,
  P.CLASS_LOGBOOK_READ, P.ATTENDANCE_READ, P.QUERY_ATTENDANCE_READ, P.QUERY_TIMETABLE_READ, P.TIMETABLE_READ,
  P.REPORT_CARD_READ, P.QUERY_REPORT_CARD_DETAIL_READ, P.DISCIPLINE_READ, P.ATTACHMENT_READ,
])
const teacherWrites = new Set([P.GRADE_INPUT, P.EXAM_CONFIG_CREATE, P.EXAM_CONFIG_UPDATE,
  P.CLASS_LOGBOOK_CREATE, P.CLASS_LOGBOOK_UPDATE, P.ATTENDANCE_RECORD, P.DISCIPLINE_CREATE, P.REPORT_CARD_PUBLISH])
const familyReads = new Set([
  P.QUERY_WORKSPACE_READ, P.STUDENT_READ, P.QUERY_STUDENT_DIRECTORY_READ, P.QUERY_STUDENT_DETAIL_READ,
  P.ENROLLMENT_READ, P.QUERY_ENROLLMENT_HISTORY_READ, P.ACADEMIC_PROGRAM_READ, P.QUERY_CLASS_DIRECTORY_READ,
  P.QUERY_CLASS_CURRICULUM_READ, P.QUERY_CURRICULUM_PROGRESS_READ, P.GRADE_READ, P.EXAM_CONFIG_READ,
  P.CLASS_LOGBOOK_READ, P.ATTENDANCE_READ, P.QUERY_ATTENDANCE_READ, P.QUERY_TIMETABLE_READ, P.TIMETABLE_READ,
  P.REPORT_CARD_READ, P.QUERY_REPORT_CARD_DETAIL_READ, P.ATTACHMENT_READ, P.PAYMENT_READ, P.FINANCIAL_CONFIG_READ,
  P.QUERY_CALENDAR_READ, P.QUERY_COMMUNICATIONS_READ,
])
const referenceResources = new Set<CoreEntityKey>(['schools', 'academicYears', 'academicPeriods', 'periodDefinitions', 'gradeScales'])
const classResources = new Set<CoreEntityKey>([
  'classGroups', 'classSubjects', 'classSubjectMatters', 'classSubjectProgress', 'subjects', 'subjectMatters',
  'gradeLevels', 'gradeLevelSubjects', 'gradeLevelSubjectMatters', 'schedules', 'lessonSessions', 'activitySessions',
  'attendances', 'activities', 'classActivityEnrollments', 'calendarEvents',
])
const teacherResources = new Set<CoreEntityKey>([
  ...classResources, 'students', 'enrollments', 'assessments', 'assessmentResults', 'results', 'definitions',
  'sections', 'attendance', 'incidents', 'studentIncidentInvolvements', 'studentDisciplinaryActions', 'attachments',
])
const familyResources = new Set<CoreEntityKey>([
  ...classResources, 'students', 'enrollments', 'assessments', 'assessmentResults', 'results', 'definitions',
  'sections', 'attendance', 'fees', 'studentFees', 'payments', 'attachments', 'activityEnrollments',
])

export async function teacherPolicy(facts: AccessFacts, action: P, resource: CoreEntityKey | undefined, intent: 'read' | 'write'): Promise<ResourceAccessClause[]> {
  const actor = facts.actor
  if (actor.kind !== 'teacher') return []
  if (intent === 'read' && (resource === 'teachers' || resource === 'teacherAssignments' || resource === 'teacherUnavailabilities')
    && [P.ACCESS_CONTROL_ASSIGN, P.SCHOOL_STRUCTURE_CONFIGURE, P.QUERY_WORKSPACE_READ].includes(action)) {
    const ids = resource === 'teachers' ? [actor.teacherId] : (await facts.list(resource, { teacherId: actor.teacherId })).map(row => row.id)
    return [{ target: { kind: 'records', ids } }]
  }
  if (!(intent === 'read' ? teacherReads : teacherWrites).has(action)) return []
  if (intent === 'read' && resource !== undefined && referenceResources.has(resource)) return [{ target: { kind: 'school' } }]
  if (resource !== undefined && !teacherResources.has(resource)) return []
  const teaching = await facts.teaching()
  const subjectClauses: ResourceAccessClause[] = teaching.subjects.map(subject => ({ target: { kind: 'class_subject', ...subject }, academicYearId: teaching.year }))
  const homeroomClauses: ResourceAccessClause[] = teaching.homerooms.map(classGroupId => ({ target: { kind: 'class_group', classGroupId }, academicYearId: teaching.year }))
  if (intent === 'read') {
    if ([P.CLASS_LOGBOOK_READ, P.QUERY_CURRICULUM_PROGRESS_READ].includes(action)) return subjectClauses
    return [...subjectClauses, ...homeroomClauses]
  }
  switch (action) {
    case P.GRADE_INPUT:
    case P.EXAM_CONFIG_CREATE:
    case P.EXAM_CONFIG_UPDATE:
      return (resource === undefined || ['assessments', 'assessmentResults', 'students', 'classGroups', 'classSubjects'].includes(resource)) ? subjectClauses : []
    case P.CLASS_LOGBOOK_CREATE:
    case P.CLASS_LOGBOOK_UPDATE:
      return (resource === undefined || ['lessonSessions', 'classSubjectProgress', 'classSubjectMatters', 'classGroups', 'classSubjects'].includes(resource)) ? subjectClauses : []
    case P.ATTENDANCE_RECORD:
      if (resource === undefined || resource === 'attendance') return [
        ...subjectClauses.map(clause => ({ ...clause, attendanceMode: 'session' as const })),
        ...homeroomClauses.map(clause => ({ ...clause, attendanceMode: 'daily' as const })),
      ]
      if (resource === 'attendances') return homeroomClauses
      if (resource === 'lessonSessions' || resource === 'assessments' || resource === 'classSubjects') return subjectClauses
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
  if ((actor.kind !== 'guardian' && actor.kind !== 'student') || intent !== 'read') return []
  if (actor.kind === 'guardian' && (resource === 'guardians' || resource === 'guardianLinks')
    && [P.QUERY_GUARDIAN_STUDENTS_ADMIN_READ, P.QUERY_GUARDIAN_SELF_READ, P.QUERY_WORKSPACE_READ].includes(action)) {
    return [{ target: { kind: 'records', ids: resource === 'guardians' ? [actor.guardianId] : (await facts.list('guardianLinks', { guardianId: actor.guardianId })).map(link => link.id) } }]
  }
  if (!familyReads.has(action)) return []
  if (resource !== undefined && referenceResources.has(resource)) return [{ target: { kind: 'school' } }]
  const studentIds = await facts.linkedStudents()
  if (action === P.QUERY_COMMUNICATIONS_READ) {
    if (resource === 'messageDeliveries') return [{ target: { kind: 'recipient', actorKind: actor.kind, actorId: actor.actorId } }]
    if (resource === 'announcements' || resource === 'announcementTargets') return [{ target: {
      kind: 'audience', actorKind: actor.kind, actorId: actor.actorId, studentIds, classGroupIds: await facts.studentClasses(studentIds),
    } }]
  }
  if (resource !== undefined && !familyResources.has(resource)) return []
  if (resource === 'sections') {
    const definitions = await facts.repository('definitions').list({ status: ReportCardDefinitionStatus.Published })
    const rows = await facts.repository('sections').list({ reportCardDefinitionId: { $in: definitions.map(row => row.id) } })
    return [{ target: { kind: 'records', ids: rows.map(row => row.id) } }]
  }
  if (resource === 'definitions') return [{ target: { kind: 'school' }, publishedOnly: true }]
  const publishedOnly = resource === 'results' || resource === 'assessmentResults'
  return studentIds.map(studentId => ({ target: { kind: 'student', studentId }, ...(publishedOnly ? { publishedOnly: true } : {}) }))
}
