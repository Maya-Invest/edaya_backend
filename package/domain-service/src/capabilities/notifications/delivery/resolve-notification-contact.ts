import type { AuthContact, Guardian, NotificationRecipientProfile, StaffMember } from '@edaya/core'

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
  return guardian.email
}

export function guardianFallbackPhone(guardian: Guardian): string | undefined {
  return guardian.phone
}

export function enrichRecipientProfile(
  profile: NotificationRecipientProfile,
  authContact?: AuthContact,
): NotificationRecipientProfile {
  const email = profile.recipient.kind === 'guardian'
    ? normalizeOptional(profile.fallbackEmail)
    : resolveNotificationEmail(
        profile.notificationEmail,
        authContact,
        profile.fallbackEmail,
      )
  const phone = profile.recipient.kind === 'guardian'
    ? normalizeOptional(profile.fallbackPhone)
    : resolveNotificationPhone(
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
