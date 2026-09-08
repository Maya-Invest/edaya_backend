import type { CalendarEvent, Guardian, GuardianStudentLink, NotificationRecipient } from '@edaya/core'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import {
  ActivityEnrollmentStatus,
  CalendarEventScopeKind,
  MessageDeliveryRecipientKind,
  StudentClassEnrollmentStatus,
} from '@edaya/core'
import { uniqueNotificationRecipients } from './recipient-utils'

async function resolveStudentRecipients(
  repositories: SchoolRepositories,
  schoolId: string,
  studentIds: readonly string[],
): Promise<NotificationRecipient[]> {
  const recipients: NotificationRecipient[] = []
  for (const studentId of studentIds) {
    const student = await repositories.students.findById(studentId)
    if (!student || student.schoolId !== schoolId || !student.subjectId) {
      continue
    }
    recipients.push({
      kind: MessageDeliveryRecipientKind.Student,
      id: student.id,
      subjectId: student.subjectId,
    })
  }
  return recipients
}

export async function resolveGuardiansForStudents(
  repositories: SchoolRepositories,
  schoolId: string,
  studentIds: readonly string[],
  linkFilter: (link: GuardianStudentLink) => boolean,
  guardianFilter: (guardian: Guardian) => boolean,
): Promise<NotificationRecipient[]> {
  const recipients: NotificationRecipient[] = []
  const seenStudents = new Set(studentIds)

  for (const studentId of seenStudents) {
    const links = await repositories.guardianLinks.list({ studentId })
    for (const link of links) {
      if (link.schoolId !== schoolId || !linkFilter(link)) {
        continue
      }
      const guardian = await repositories.guardians.findById(link.guardianId)
      if (!guardian || guardian.schoolId !== schoolId || !guardianFilter(guardian) || !guardian.subjectId) {
        continue
      }
      recipients.push({
        kind: MessageDeliveryRecipientKind.Guardian,
        id: guardian.id,
        subjectId: guardian.subjectId,
      })
    }
  }

  return recipients
}

export async function resolveClassGroupStudentAndGuardianRecipients(
  repositories: SchoolRepositories,
  schoolId: string,
  classGroupId: string,
  linkFilter: (link: GuardianStudentLink) => boolean = () => true,
): Promise<NotificationRecipient[]> {
  const enrollments = await repositories.enrollments.list({
    classGroupId,
    status: StudentClassEnrollmentStatus.Active,
  })
  if (enrollments.length === 0) {
    return []
  }

  const studentRecipients = await resolveStudentRecipients(
    repositories,
    schoolId,
    enrollments.map(enrollment => enrollment.studentId),
  )
  const guardianRecipients = await resolveGuardiansForStudents(
    repositories,
    schoolId,
    enrollments.map(enrollment => enrollment.studentId),
    linkFilter,
    guardian => guardian.contactMethods.some(method => method.allowsNotifications),
  )

  return uniqueNotificationRecipients([...studentRecipients, ...guardianRecipients])
}

export async function resolveActivityEnrollmentRecipients(
  repositories: SchoolRepositories,
  schoolId: string,
  activityId: string,
): Promise<NotificationRecipient[]> {
  const enrollments = await repositories.activityEnrollments.list({ activityId })
  const approvedStudentIds = enrollments
    .filter(enrollment => enrollment.status === ActivityEnrollmentStatus.Approved)
    .map(enrollment => enrollment.studentId)

  if (approvedStudentIds.length === 0) {
    return []
  }

  const studentRecipients = await resolveStudentRecipients(repositories, schoolId, approvedStudentIds)
  const guardianRecipients = await resolveGuardiansForStudents(
    repositories,
    schoolId,
    approvedStudentIds,
    () => true,
    guardian => guardian.contactMethods.some(method => method.allowsNotifications),
  )

  return uniqueNotificationRecipients([...studentRecipients, ...guardianRecipients])
}

export async function resolveStudentAndAcademicGuardianRecipients(
  repositories: SchoolRepositories,
  schoolId: string,
  studentId: string,
): Promise<NotificationRecipient[]> {
  const studentRecipients = await resolveStudentRecipients(repositories, schoolId, [studentId])
  const guardianRecipients = await resolveGuardiansForStudents(
    repositories,
    schoolId,
    [studentId],
    link => link.receivesAcademicReports,
    () => true,
  )

  return uniqueNotificationRecipients([...studentRecipients, ...guardianRecipients])
}

export async function resolveCalendarEventRecipients(
  repositories: SchoolRepositories,
  event: CalendarEvent,
): Promise<NotificationRecipient[]> {
  if (event.scopeKind === CalendarEventScopeKind.School) {
    return []
  }

  if (event.scopeKind === CalendarEventScopeKind.ClassGroup && event.scopeId) {
    const classGroup = await repositories.classGroups.findById(event.scopeId)
    if (!classGroup || classGroup.schoolId !== event.schoolId) {
      return []
    }
    return resolveClassGroupStudentAndGuardianRecipients(
      repositories,
      event.schoolId,
      classGroup.id,
      () => true,
    )
  }

  if (event.scopeKind === CalendarEventScopeKind.GradeLevel && event.scopeId) {
    const classGroups = await repositories.classGroups.list()
    const scopedClassGroups = classGroups.filter(classGroup =>
      classGroup.schoolId === event.schoolId
      && classGroup.academicYearId === event.academicYearId
      && classGroup.gradeLevelId === event.scopeId,
    )
    const recipients: NotificationRecipient[] = []
    for (const classGroup of scopedClassGroups) {
      recipients.push(...await resolveClassGroupStudentAndGuardianRecipients(
        repositories,
        event.schoolId,
        classGroup.id,
        () => true,
      ))
    }
    return uniqueNotificationRecipients(recipients)
  }

  return []
}
