import type { Guardian, GuardianStudentLink, NotificationRecipientProfile, StaffMember, Student, Teacher } from '@edaya/core'
import { MessageDeliveryRecipientKind } from '@edaya/core'
import { normalizeInvitationEmail } from '../../invitations/resolve-invitation-contact'
import {
  guardianFallbackEmail,
  guardianFallbackPhone,
  staffFallbackEmail,
} from './resolve-notification-contact'

export function buildStaffRecipientProfile(staff: StaffMember): NotificationRecipientProfile | undefined {
  if (!staff.subjectId || staff.accountKind !== 'human' || !staff.isActive) {
    return undefined
  }

  const fallbackEmail = staffFallbackEmail(staff)

  return {
    schoolId: staff.schoolId,
    recipient: {
      kind: MessageDeliveryRecipientKind.Staff,
      id: staff.id,
      subjectId: staff.subjectId,
    },
    displayName: staff.fullName,
    notificationEmail: staff.notificationEmail,
    notificationPhone: staff.notificationPhone,
    fallbackEmail,
    preferences: {
      allowsNotifications: true,
      channels: {
        email: Boolean(staff.notificationEmail ?? fallbackEmail),
        sms: Boolean(staff.notificationPhone),
        in_app: true,
      },
    },
  }
}

export function buildGuardianRecipientProfile(
  guardian: Guardian,
  links: readonly GuardianStudentLink[],
): NotificationRecipientProfile | undefined {
  if (!guardian.subjectId || !guardian.hasAccess) {
    return undefined
  }

  const fallbackEmail = guardianFallbackEmail(guardian)
  const fallbackPhone = guardianFallbackPhone(guardian)

  return {
    schoolId: guardian.schoolId,
    recipient: {
      kind: MessageDeliveryRecipientKind.Guardian,
      id: guardian.id,
      subjectId: guardian.subjectId,
    },
    displayName: guardian.fullName,
    fallbackEmail,
    fallbackPhone,
    preferences: {
      allowsNotifications: true,
      receivesAcademicReports: links.some(link => link.receivesAcademicReports),
      receivesAttendanceAlerts: links.some(link => link.receivesAttendanceAlerts),
      channels: {
        email: guardian.emailNotificationsEnabled && Boolean(guardian.email),
        sms: guardian.smsNotificationsEnabled && Boolean(guardian.phone),
        in_app: true,
        push: guardian.pushNotificationsEnabled,
      },
    },
  }
}

export function buildStudentRecipientProfile(student: Student): NotificationRecipientProfile | undefined {
  if (!student.subjectId || student.status !== 'active') {
    return undefined
  }

  return {
    schoolId: student.schoolId,
    recipient: {
      kind: MessageDeliveryRecipientKind.Student,
      id: student.id,
      subjectId: student.subjectId,
    },
    displayName: `${student.firstName} ${student.lastName}`,
    preferences: {
      allowsNotifications: true,
      channels: {
        in_app: true,
      },
    },
  }
}

export function buildTeacherRecipientProfile(teacher: Teacher): NotificationRecipientProfile | undefined {
  if (!teacher.subjectId || !teacher.isActive) {
    return undefined
  }

  const fallbackEmail = normalizeInvitationEmail(teacher.notificationEmail ?? teacher.email)

  return {
    schoolId: teacher.schoolId,
    recipient: {
      kind: MessageDeliveryRecipientKind.Teacher,
      id: teacher.id,
      subjectId: teacher.subjectId,
    },
    displayName: teacher.fullName,
    notificationEmail: teacher.notificationEmail,
    notificationPhone: teacher.notificationPhone,
    fallbackEmail,
    preferences: {
      allowsNotifications: true,
      channels: {
        email: Boolean(teacher.notificationEmail ?? fallbackEmail),
        sms: Boolean(teacher.notificationPhone),
        in_app: true,
      },
    },
  }
}
