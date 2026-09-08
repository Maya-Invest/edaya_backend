export type OnboardingStaffInviteRoleKey
  = | 'deputy_director'
    | 'cpe'
    | 'secretary'
    | 'studies_director'
    | 'it_admin'
    | 'accountant'

export const ONBOARDING_STAFF_INVITE_ROLE_KEYS: readonly OnboardingStaffInviteRoleKey[] = [
  'deputy_director',
  'cpe',
  'secretary',
  'studies_director',
  'it_admin',
  'accountant',
]

export function isOnboardingStaffInviteRoleKey(value: string): value is OnboardingStaffInviteRoleKey {
  return (ONBOARDING_STAFF_INVITE_ROLE_KEYS as readonly string[]).includes(value)
}

export const ACCESS_ROLE_ID_BY_INVITE_ROLE: Record<OnboardingStaffInviteRoleKey, string> = {
  deputy_director: 'role-coordinator',
  cpe: 'role-educator',
  secretary: 'role-coordinator',
  studies_director: 'role-studies-director',
  it_admin: 'role-it-admin',
  accountant: 'role-accountant',
}
