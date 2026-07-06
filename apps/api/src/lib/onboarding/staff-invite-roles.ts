export type OnboardingStaffInviteRoleKey =
  | "deputy_director"
  | "cpe"
  | "secretary";

export const ONBOARDING_STAFF_INVITE_ROLE_KEYS: readonly OnboardingStaffInviteRoleKey[] = [
  "deputy_director",
  "cpe",
  "secretary",
];

export function isOnboardingStaffInviteRoleKey(value: string): value is OnboardingStaffInviteRoleKey {
  return (ONBOARDING_STAFF_INVITE_ROLE_KEYS as readonly string[]).includes(value);
}

export const ACCESS_ROLE_ID_BY_INVITE_ROLE: Record<OnboardingStaffInviteRoleKey, string> = {
  deputy_director: "role-coordinator",
  cpe: "role-educator",
  secretary: "role-coordinator",
};
