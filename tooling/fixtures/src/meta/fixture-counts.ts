import type { StudentClassEnrollmentInput } from '@edaya/core'
import type { FixtureDataset } from '../datasets/types'
import { AnnouncementTargetKind, MessageDeliveryRecipientKind } from '@edaya/core'
import { demoDataset } from '../datasets/demo'
import { DEMO_CI_SCHOOL_ID } from '../shared/ids'
import { DEV_AUTH_GUARDIAN_ACCOUNTS, DEV_AUTH_STAFF_ACCOUNTS } from './dev-auth-fixtures'
import { DEV_CI_AUTH_GUARDIAN_ACCOUNTS, DEV_CI_AUTH_STAFF_ACCOUNTS } from './dev-auth-fixtures-ci'

export type ExpectedFixtureCounts = ReturnType<typeof resolveExpectedCounts>

function countArray<T>(items: readonly T[] | undefined): number {
  return items?.length ?? 0
}

export function countStudents(dataset: FixtureDataset): number {
  return countArray(dataset.entities.students)
}

export function countGuardians(dataset: FixtureDataset): number {
  return countArray(dataset.entities.guardians)
}

export function countGuardianLinks(dataset: FixtureDataset): number {
  return countArray(dataset.entities.guardianLinks)
}

export function countClassGroups(dataset: FixtureDataset): number {
  return countArray(dataset.entities.classGroups)
}

export function buildClassStudentIdsFromEnrollments(
  enrollments: readonly StudentClassEnrollmentInput[],
): Record<string, readonly string[]> {
  const map = new Map<string, string[]>()
  for (const enrollment of enrollments) {
    const current = map.get(enrollment.classGroupId) ?? []
    current.push(enrollment.studentId)
    map.set(enrollment.classGroupId, current)
  }
  return Object.fromEntries(map)
}

export function buildClassStudentIds(
  dataset: FixtureDataset,
): Record<string, readonly string[]> {
  return buildClassStudentIdsFromEnrollments(dataset.entities.enrollments ?? [])
}

function countUniqueGradeLevelSubjects(dataset: FixtureDataset): number {
  const classGroups = dataset.entities.classGroups ?? []
  const classSubjects = dataset.entities.classSubjects ?? []
  const gradeLevelByClassId = Object.fromEntries(
    classGroups.map(classGroup => [classGroup.id, classGroup.gradeLevelId]),
  )
  const seen = new Set<string>()
  for (const offering of classSubjects) {
    const gradeLevelId = gradeLevelByClassId[offering.classGroupId]
    if (!gradeLevelId) {
      continue
    }
    seen.add(`${gradeLevelId}:${offering.subjectId}`)
  }
  return seen.size
}

function mattersBySubjectId(
  subjectMatters: NonNullable<FixtureDataset['entities']['subjectMatters']>,
): Map<string, NonNullable<FixtureDataset['entities']['subjectMatters']>[number][]> {
  const grouped = new Map<string, NonNullable<FixtureDataset['entities']['subjectMatters']>[number][]>()
  for (const matter of subjectMatters) {
    const existing = grouped.get(matter.subjectId) ?? []
    existing.push(matter)
    grouped.set(matter.subjectId, existing)
  }
  return grouped
}

function countGradeLevelSubjectMatters(dataset: FixtureDataset): number {
  const subjectMattersBySubjectId = mattersBySubjectId(dataset.entities.subjectMatters ?? [])
  const classGroups = dataset.entities.classGroups ?? []
  const classSubjects = dataset.entities.classSubjects ?? []
  const gradeLevelByClassId = Object.fromEntries(
    classGroups.map(classGroup => [classGroup.id, classGroup.gradeLevelId]),
  )
  const seen = new Set<string>()
  for (const offering of classSubjects) {
    const gradeLevelId = gradeLevelByClassId[offering.classGroupId]
    if (!gradeLevelId) {
      continue
    }
    for (const matter of subjectMattersBySubjectId.get(offering.subjectId) ?? []) {
      seen.add(`${gradeLevelId}:${offering.subjectId}:${matter.id}`)
    }
  }
  return seen.size
}

function countClassSubjectProgress(dataset: FixtureDataset): number {
  if (dataset.extensions?.skipLessonSessionSeeding) {
    return 0
  }
  const anchorCount = (dataset.extensions?.schedulingSessionProgressAnchors?.length ?? 0)
    + (dataset.extensions?.schedulingSessionProgressAnchor ? 1 : 0)
  return anchorCount > 0 ? anchorCount : 1
}

function countClassSubjectMatters(dataset: FixtureDataset): number {
  const subjectMattersBySubjectId = mattersBySubjectId(dataset.entities.subjectMatters ?? [])
  return (dataset.entities.classSubjects ?? []).reduce((total, offering) => {
    return total + (subjectMattersBySubjectId.get(offering.subjectId)?.length ?? 0)
  }, 0)
}

function countSchedulingSlots(dataset: FixtureDataset): number {
  const slots = dataset.extensions?.schedulingSlots
  if (slots) {
    return slots.length
  }
  return countArray(dataset.entities.schedules)
}

function countResourceAssignments(dataset: FixtureDataset): number {
  const classLevel = countArray(dataset.extensions?.classResourceAssignments)
  if (dataset.extensions?.skipLessonSessionSeeding) {
    return classLevel
  }
  const lessonSession = dataset.extensions?.schedulingSlots?.filter(slot => slot.resourceId).length ?? 0
  return classLevel + lessonSession
}

function countLessonSessions(dataset: FixtureDataset): number {
  if (dataset.extensions?.skipLessonSessionSeeding) {
    return 0
  }
  return countSchedulingSlots(dataset)
}

function countAttendanceRecords(dataset: FixtureDataset): number {
  if (dataset.extensions?.skipLessonSessionSeeding) {
    return 0
  }
  const dailyRecords = (dataset.extensions?.dailyAttendanceDays ?? [])
    .reduce((total, day) => total + Object.keys(day.attendanceByStudent).length, 0)
  const attendanceRecords = dataset.entities.attendanceRecords
  if (attendanceRecords) {
    return attendanceRecords.length + dailyRecords
  }
  const sessions = dataset.extensions?.attendanceSessions
  if (!sessions) {
    return dailyRecords
  }
  return sessions.absenceSessions.reduce(
    (total, session) => total + session.records.length,
    sessions.todaySession.records.length,
  ) + dailyRecords
}

function countAssessmentResults(dataset: FixtureDataset): number {
  const homeworkResults = countArray(dataset.entities.homeworkSubmissions)
  const inClassScores = dataset.extensions?.assessmentResultScores ?? {}
  const inClassResults = Object.values(inClassScores)
    .reduce((total, scoresByStudent) => total + Object.keys(scoresByStudent).length, 0)
  return homeworkResults + inClassResults
}

function countAssessments(dataset: FixtureDataset): number {
  return countArray(dataset.entities.inClassAssessments)
    + countArray(dataset.entities.homeworkAssessments)
}

function countReportCardSections(dataset: FixtureDataset): number {
  return (dataset.extensions?.reportCardDefinitionFixtures ?? [])
    .reduce((total, definition) => total + definition.sections.length, 0)
}

function countStudentFees(dataset: FixtureDataset): number {
  return countArray(dataset.entities.studentFees)
}

function countCalendarEvents(dataset: FixtureDataset): number {
  return countArray(dataset.extensions?.calendarEvents)
}

function countStudentIncidentInvolvements(dataset: FixtureDataset): number {
  return countArray(dataset.entities.studentIncidentInvolvements)
}

function countAttachments(dataset: FixtureDataset): number {
  return countArray(dataset.entities.attachments)
}

export function countMessageDeliveriesMinimum(dataset: FixtureDataset): number {
  const ci = dataset.schoolId === DEMO_CI_SCHOOL_ID
  const guardianAccounts = ci ? DEV_CI_AUTH_GUARDIAN_ACCOUNTS : DEV_AUTH_GUARDIAN_ACCOUNTS
  const staffAccounts = ci ? DEV_CI_AUTH_STAFF_ACCOUNTS : DEV_AUTH_STAFF_ACCOUNTS
  const guardians = new Set((dataset.entities.guardians ?? [])
    .filter(guardian => guardian.hasAccess !== false && guardianAccounts.some(account => account.guardianId === guardian.id))
    .map(guardian => guardian.id))
  const staff = new Set((dataset.entities.staffMembers ?? [])
    .filter(member => member.isActive !== false && staffAccounts.some(account => account.staffId === member.id))
    .map(member => member.id))
  // Seed students have no provisioned login. Placeholder fixture subject IDs are not recipients.
  const explicit = (dataset.entities.messageDeliveries ?? []).filter(delivery =>
    delivery.recipientKind === MessageDeliveryRecipientKind.Guardian
      ? guardians.has(delivery.recipientId ?? '')
      : delivery.recipientKind === MessageDeliveryRecipientKind.Staff && staff.has(delivery.recipientId ?? ''),
  ).length
  let materialized = 0
  for (const plan of dataset.extensions?.announcementMaterializePlans ?? []) {
    const targets = (dataset.entities.announcementTargets ?? []).filter(target => target.announcementId === plan.announcementId)
    if (targets.some(target => target.targetKind === AnnouncementTargetKind.AllGuardians))
      materialized += guardians.size
    if (targets.some(target => target.targetKind === AnnouncementTargetKind.AllStaff))
      materialized += staff.size
  }
  return explicit + materialized
}

/** Expected minimum persisted row counts keyed by manifest entity slug. */
export function resolveExpectedCounts(dataset: FixtureDataset) {
  const entities = dataset.entities
  const students = countStudents(dataset)
  const guardians = countGuardians(dataset)
  const staff = countArray(entities.staffMembers)

  return {
    'schools': entities.school ? 1 : 0,
    'academic-years': entities.academicYear ? 1 : 0,
    'academic-periods': countArray(entities.academicPeriods),
    'grade-levels': countArray(entities.gradeLevels),
    'period-definitions': countArray(entities.periodDefinitions),
    'class-groups': countClassGroups(dataset),
    'staff-members': staff,
    'students': students,
    'enrollments': students,
    'guardians': guardians,
    'guardian-links': countGuardianLinks(dataset),
    'subjects': countArray(entities.subjects),
    'subject-matters': countArray(entities.subjectMatters),
    'grade-level-subjects': countUniqueGradeLevelSubjects(dataset),
    'grade-level-subject-matters': countGradeLevelSubjectMatters(dataset),
    'class-subjects': countArray(entities.classSubjects),
    'class-subject-matters': countClassSubjectMatters(dataset),
    'teachers': countArray(entities.teachers),
    'teacher-assignments': countArray(entities.teacherAssignments),
    'resources': countArray(entities.resources),
    'schedules': countSchedulingSlots(dataset),
    'lesson-sessions': countLessonSessions(dataset),
    'staff-assignments': 5 + (demoDataset.extensions?.classSubjectStaffAssignments?.length ?? 0),
    'resource-assignments': countResourceAssignments(dataset),
    'class-subject-progress': countClassSubjectProgress(dataset),
    'assessments': countAssessments(dataset),
    'assessment-results': countAssessmentResults(dataset),
    'activities': countArray(entities.activities),
    'activity-enrollments': countArray(entities.activityEnrollments),
    'calendar-events': countCalendarEvents(dataset),
    'incidents': countArray(entities.incidents),
    'student-incident-involvements': countStudentIncidentInvolvements(dataset),
    'attendance': countAttendanceRecords(dataset),
    'student-health-profiles': countArray(entities.studentHealthProfiles),
    'student-notes': countArray(entities.studentNotes),
    'fees': countArray(entities.fees),
    'student-fees': countStudentFees(dataset),
    'payments': countArray(entities.payments),
    'grade-scales': countArray(entities.gradeScales),
    'definitions': countArray(dataset.extensions?.reportCardDefinitionFixtures),
    'sections': countReportCardSections(dataset),
    'results': countArray(dataset.extensions?.reportCardResults),
    'staff-permission-assignments': 50,
    'announcements': countArray(entities.announcements),
    'announcement-targets': countArray(entities.announcementTargets),
    'message-deliveries': countMessageDeliveriesMinimum(dataset),
    'disciplinary-actions': countArray(entities.disciplinaryActions),
    'student-disciplinary-actions': countArray(entities.studentDisciplinaryActions),
    'attachments': countAttachments(dataset),
    'profile-photos': staff + students + guardians,
  }
}
