import type { Guardian, StaffMember, Student, Teacher } from '@edaya/core'
import { AccountInvitationContactChannel } from '@edaya/core'
import { guardianFallbackEmail, staffFallbackEmail } from '../notifications/delivery/resolve-notification-contact'

export function normalizeInvitationEmail(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

export function resolveStaffInvitationEmail(staff: StaffMember): string | undefined {
  return normalizeInvitationEmail(staff.notificationEmail ?? staffFallbackEmail(staff))
}

export function resolveGuardianInvitationEmail(guardian: Guardian): string | undefined {
  return normalizeInvitationEmail(
    guardianFallbackEmail(guardian),
  )
}

export function resolveTeacherInvitationEmail(teacher: Teacher): string | undefined {
  return normalizeInvitationEmail(teacher.notificationEmail ?? teacher.email)
}

export function normalizeInvitationPhone(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized?.startsWith('+') ? normalized : undefined
}

export function resolveInvitationContact(
  channel: AccountInvitationContactChannel,
  explicitValue: string | undefined,
  staff?: StaffMember,
  guardian?: Guardian,
  teacher?: Teacher,
): string | undefined {
  if (channel === AccountInvitationContactChannel.Phone) {
    return normalizeInvitationPhone(explicitValue)
      ?? normalizeInvitationPhone(staff?.notificationPhone)
      ?? normalizeInvitationPhone(guardian?.phone)
      ?? normalizeInvitationPhone(teacher?.phone)
  }

  const explicitEmail = normalizeInvitationEmail(explicitValue)
  if (explicitEmail) {
    return explicitEmail
  }
  if (staff) {
    return resolveStaffInvitationEmail(staff)
  }
  if (guardian) {
    return resolveGuardianInvitationEmail(guardian)
  }
  if (teacher) {
    return resolveTeacherInvitationEmail(teacher)
  }
  return undefined
}

export function resolveStudentInvitationContact(
  channel: AccountInvitationContactChannel,
  explicitValue: string | undefined,
): string | undefined {
  if (channel === AccountInvitationContactChannel.Phone) {
    return normalizeInvitationPhone(explicitValue)
  }
  return normalizeInvitationEmail(explicitValue)
}

export function guardianHasEmailContact(guardian: Guardian): boolean {
  return Boolean(guardian.email)
}

export function resolveStudentInvitationEmail(explicitValue: string | undefined): string | undefined {
  return normalizeInvitationEmail(explicitValue)
}

export function resolveInviteeDisplayName(entity: StaffMember | Guardian | Student | Teacher): string {
  return `${entity.firstName} ${entity.lastName}`.trim()
}
