import type { Guardian, GuardianStudentLink, StaffMember, Student } from '../domains'
import type { NotificationRecipientProfile } from '../ports/notification-gateway'
import { GuardianContactMethodType, MessageDeliveryRecipientKind } from '../domains'
import {
  guardianFallbackEmail,
  guardianFallbackPhone,
  staffFallbackEmail,
} from './resolve-notification-contact'

function guardianAllowsChannel(
  guardian: Guardian,
  types: readonly GuardianContactMethodType[],
): boolean {
  return guardian.contactMethods.some(method =>
    types.includes(method.type) && method.allowsNotifications,
  )
}

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

  const allowsNotifications = guardian.contactMethods.some(method => method.allowsNotifications)
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
    notificationEmail: guardian.notificationEmail,
    notificationPhone: guardian.notificationPhone,
    fallbackEmail,
    fallbackPhone,
    preferences: {
      allowsNotifications,
      receivesAcademicReports: links.some(link => link.receivesAcademicReports),
      receivesAttendanceAlerts: links.some(link => link.receivesAttendanceAlerts),
      channels: {
        email: guardianAllowsChannel(guardian, [GuardianContactMethodType.Email]),
        sms: guardianAllowsChannel(guardian, [
          GuardianContactMethodType.Phone,
          GuardianContactMethodType.Sms,
          GuardianContactMethodType.Whatsapp,
        ]),
        in_app: allowsNotifications,
        push: allowsNotifications,
      },
    },
  }
}

export function buildStudentRecipientProfile(student: Student): NotificationRecipientProfile | undefined {
  if (!student.subjectId) {
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
