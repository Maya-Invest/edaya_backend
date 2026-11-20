import type { CoreEntityKey, ResourceAccessClause } from '@edaya/core'
import type { MutationOperation } from './access-policies'
import type { AccessFacts } from './facts'
import { AttachmentOwnerKind as Owner, Permission as P } from '@edaya/core'

const teacherReads = new Set([
  P.ACTIVITY_READ,
  P.ACADEMIC_CATALOG_READ,
  P.PERSONAL_COMMUNICATIONS_READ,
  P.TIMETABLE_READ,
  P.WORKSPACE_ACCESS,
  P.STUDENT_READ,
  P.ENROLLMENT_READ,
  P.ACADEMIC_PROGRAM_READ,
  P.CLASS_READ,
  P.CLASS_LOGBOOK_READ,
  P.GRADE_READ,
  P.ASSESSMENT_READ,
  P.ATTENDANCE_READ,
  P.REPORT_CARD_READ,
  P.DISCIPLINE_READ,
  P.ATTACHMENT_READ,
])
const teacherWrites = new Set([P.GRADE_MANAGE, P.ASSESSMENT_MANAGE, P.CLASS_LOGBOOK_MANAGE, P.ATTENDANCE_RECORD, P.DISCIPLINE_CREATE, P.REPORT_CARD_COMMENT])
const familyReads = new Set([
  P.ACTIVITY_READ,
  P.ACADEMIC_CATALOG_READ,
  P.WORKSPACE_ACCESS,
  P.STUDENT_READ,
  P.ENROLLMENT_READ,
  P.ACADEMIC_PROGRAM_READ,
  P.CLASS_READ,
  P.CLASS_LOGBOOK_READ,
  P.GRADE_READ,
  P.ASSESSMENT_READ,
  P.ATTENDANCE_READ,
  P.TIMETABLE_READ,
  P.REPORT_CARD_READ,
  P.ATTACHMENT_READ,
  P.PAYMENT_READ,
  P.FINANCIAL_CONFIG_READ,
  P.PERSONAL_COMMUNICATIONS_READ,
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
  'subjectEnrollments',
  'assessments',
  'assessmentResults',
  'results',
  'attendance',
  'incidents',
  'studentIncidentInvolvements',
  'studentDisciplinaryActions',
  'attachments',
  'documentIssuances',
])
const familyResources = new Set<CoreEntityKey>([
  ...classResources,
  'students',
  'enrollments',
  'subjectEnrollments',
  'assessments',
  'assessmentResults',
  'results',
  'attendance',
  'catalogServices',
  'studentServiceEnrollments',
  'studentCharges',
  'studentYearAccounts',
  'payments',
  'attachments',
  'activityEnrollments',
  'studentPhotoSubmissions',
  'documentIssuances',
])

/** An admitted read with no current relationships returns an empty SQL result. */
function visibleRows(clauses: ResourceAccessClause[]): ResourceAccessClause[] {
  return clauses.length ? clauses : [{ target: { kind: 'records', ids: [] } }]
}

export async function teacherPolicy(facts: AccessFacts, action: P, resource: CoreEntityKey | undefined, intent: 'read' | 'write', operation?: MutationOperation): Promise<ResourceAccessClause[]> {
  const actor = facts.actor
  if (actor.kind !== 'teacher')
    return []
  if (intent === 'read' && (resource === 'teachers' || resource === 'teacherAssignments' || resource === 'teacherUnavailabilities')
    && [P.STAFF_READ, P.ACCESS_CONTROL_READ].includes(action)) {
    const ids = resource === 'teachers' ? [actor.teacherId] : (await facts.list(resource, { teacherId: actor.teacherId })).map(row => row.id)
    return [{ target: { kind: 'records', ids } }]
  }
  if (intent === 'write' && action === P.ASSESSMENT_MANAGE && (!operation || operation === 'delete'))
    return []
  if (!(intent === 'read' ? teacherReads : teacherWrites).has(action))
    return []
  if (intent === 'read' && resource !== undefined && referenceResources.has(resource))
    return [{ target: { kind: 'school' } }]
  const teaching = await facts.teaching()
  if (action === P.PERSONAL_COMMUNICATIONS_READ && intent === 'read') {
    if (resource === 'messageDeliveries')
      return [{ target: { kind: 'recipient', actorKind: actor.kind, actorId: actor.actorId, subjectId: actor.subjectId } }]
    if (resource === 'announcements' || resource === 'announcementTargets')
      return [{ target: await facts.communicationAudience(actor.kind, actor.actorId) }]
  }
  if (resource !== undefined && !teacherResources.has(resource))
    return []
  const subjectClauses: ResourceAccessClause[] = teaching.subjects.map(({ gradeLevelId, subjectId, classGroupId }) => ({ target: { kind: 'subject', gradeLevelId, subjectId, classGroupId }, academicYearId: teaching.year }))
  const homeroomClauses: ResourceAccessClause[] = teaching.homerooms.map(classGroupId => ({ target: { kind: 'class_group', classGroupId }, academicYearId: teaching.year }))
  if (intent === 'read') {
    if ([P.CLASS_LOGBOOK_READ].includes(action))
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
    case P.GRADE_MANAGE:
    case P.ASSESSMENT_MANAGE:
      return (resource === undefined || ['assessments', 'assessmentResults', 'students', 'classGroups', 'classSubjects'].includes(resource)) ? subjectClauses : []
    case P.CLASS_LOGBOOK_MANAGE:
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
    case P.REPORT_CARD_COMMENT:
      return resource === undefined || resource === 'results' ? [...subjectClauses, ...homeroomClauses] : []
    default: return []
  }
}

export async function familyPolicy(facts: AccessFacts, action: P, resource: CoreEntityKey | undefined, intent: 'read' | 'write', operation?: MutationOperation): Promise<ResourceAccessClause[]> {
  const actor = facts.actor
  if (actor.kind !== 'guardian' && actor.kind !== 'student')
    return []
  if (intent === 'write') {
    if (actor.kind !== 'guardian' || action !== P.PARENT_MANAGE || !operation || operation === 'delete')
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
    && [P.PARENT_READ, P.GUARDIAN_SELF_READ, P.WORKSPACE_ACCESS, P.PERSONAL_COMMUNICATIONS_READ].includes(action)) {
    return [{ target: { kind: 'records', ids: resource === 'guardians' ? [actor.guardianId] : (await facts.list('guardianLinks', { guardianId: actor.guardianId })).map(link => link.id) } }]
  }
  if (!familyReads.has(action))
    return []
  if (resource !== undefined && referenceResources.has(resource))
    return [{ target: { kind: 'school' } }]
  const studentIds = await facts.linkedStudents()
  if (action === P.PERSONAL_COMMUNICATIONS_READ) {
    if (resource === 'messageDeliveries')
      return [{ target: { kind: 'recipient', actorKind: actor.kind, actorId: actor.actorId, subjectId: actor.subjectId } }]
    if (resource === 'announcements' || resource === 'announcementTargets') {
      return [{ target: await facts.communicationAudience(actor.kind, actor.actorId) }]
    }
  }
  if (resource !== undefined && !familyResources.has(resource))
    return []
  const academicYearId = await facts.academicYear()
  if (!academicYearId && resource !== undefined && resource !== 'students' && resource !== 'attachments' && resource !== 'studentPhotoSubmissions')
    return visibleRows([])
  if (resource === 'attachments') {
    const ownProfile: ResourceAccessClause[] = actor.kind === 'guardian' ? [{ target: { kind: 'records', ids: [actor.guardianId] }, attachmentOwners: [Owner.Guardian] }] : []
    return visibleRows([...ownProfile, ...studentIds.flatMap(studentId => [
      { target: { kind: 'student' as const, studentId }, academicYearId, attachmentOwners: [Owner.Student, Owner.StudentClassEnrollment, Owner.AttendanceRecord, Owner.Payment] },
      { target: { kind: 'student' as const, studentId }, academicYearId, attachmentOwners: [Owner.AssessmentResult], submittedMarksOnly: true },
      { target: { kind: 'student' as const, studentId }, academicYearId, attachmentOwners: [Owner.ReportCard], publishedOnly: true },
    ])])
  }
  // Families see only reviewed marks, scoped in SQL before pagination/counts.
  return visibleRows(studentIds.map(studentId => ({
    target: { kind: 'student', studentId },
    academicYearId,
    ...(resource === 'results' ? { publishedOnly: true } : {}),
    ...(resource === 'assessmentResults' ? { submittedMarksOnly: true } : {}),
  })))
}
