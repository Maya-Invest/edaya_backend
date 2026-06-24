import type { Guardian, StaffMember } from '../domains'
import { GuardianContactMethodType } from '../domains'
import type { AuthContact } from '../ports/auth-contact-resolver'
import type { NotificationRecipientProfile } from '../ports/notification-gateway'

function normalizeOptional(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

export function resolveNotificationEmail(
  notificationEmail: string | undefined,
  authContact: AuthContact | undefined,
  fallbackEmail: string | undefined,
): string | undefined {
  return normalizeOptional(notificationEmail)
    ?? normalizeOptional(authContact?.email)
    ?? normalizeOptional(fallbackEmail)
}

export function resolveNotificationPhone(
  notificationPhone: string | undefined,
  authContact: AuthContact | undefined,
  fallbackPhone: string | undefined,
): string | undefined {
  return normalizeOptional(notificationPhone)
    ?? normalizeOptional(authContact?.phone)
    ?? normalizeOptional(fallbackPhone)
}

export function guardianFallbackEmail(guardian: Guardian): string | undefined {
  return guardian.contactMethods.find(method =>
    method.type === GuardianContactMethodType.Email && method.allowsNotifications,
  )?.value ?? guardian.email
}

export function guardianFallbackPhone(guardian: Guardian): string | undefined {
  return guardian.contactMethods.find(method =>
    (
      method.type === GuardianContactMethodType.Phone
      || method.type === GuardianContactMethodType.Sms
      || method.type === GuardianContactMethodType.Whatsapp
    ) && method.allowsNotifications,
  )?.value ?? guardian.phone
}

export function enrichRecipientProfile(
  profile: NotificationRecipientProfile,
  authContact?: AuthContact,
): NotificationRecipientProfile {
  const email = resolveNotificationEmail(
    profile.notificationEmail,
    authContact,
    profile.fallbackEmail,
  )
  const phone = resolveNotificationPhone(
    profile.notificationPhone,
    authContact,
    profile.fallbackPhone,
  )

  return {
    ...profile,
    email,
    phone,
    preferences: {
      ...profile.preferences,
      channels: {
        ...profile.preferences.channels,
        email: Boolean(email) && (profile.preferences.channels?.email ?? true),
        sms: Boolean(phone) && (profile.preferences.channels?.sms ?? false),
      },
    },
  }
}

export function staffFallbackEmail(staff: StaffMember): string | undefined {
  return staff.email
}
