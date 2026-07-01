import type { Guardian, StaffMember, Student } from '../domains'
import { AccountInvitationContactChannel } from '../domains/access/account-invitation'
import { GuardianContactMethodType } from '../domains/students/guardian-contact-method'
import { guardianFallbackEmail, staffFallbackEmail } from '../notifications/resolve-notification-contact'

export function normalizeInvitationEmail(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

export function resolveStaffInvitationEmail(staff: StaffMember): string | undefined {
  return normalizeInvitationEmail(staff.notificationEmail ?? staffFallbackEmail(staff))
}

export function resolveGuardianInvitationEmail(guardian: Guardian): string | undefined {
  return normalizeInvitationEmail(
    guardian.notificationEmail
    ?? guardianFallbackEmail(guardian),
  )
}

export function resolveInvitationContact(
  channel: AccountInvitationContactChannel,
  explicitValue: string | undefined,
  staff?: StaffMember,
  guardian?: Guardian,
): string | undefined {
  if (channel === AccountInvitationContactChannel.Phone) {
    const phone = explicitValue?.trim()
    return phone && phone.length > 0 ? phone : undefined
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
  return undefined
}

export function guardianHasEmailContact(guardian: Guardian): boolean {
  return guardian.contactMethods.some(method => method.type === GuardianContactMethodType.Email)
    || Boolean(guardian.email)
}

export function resolveStudentInvitationEmail(explicitValue: string | undefined): string | undefined {
  return normalizeInvitationEmail(explicitValue)
}

export function resolveInviteeDisplayName(entity: StaffMember | Guardian | Student): string {
  return `${entity.firstName} ${entity.lastName}`.trim()
}
