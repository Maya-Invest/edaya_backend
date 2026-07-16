/** Header sent by demo seed provisioners so sign-up creates email-verified users. */
export const SEED_AUTH_PROVISION_HEADER = "x-edaya-seed-provision";

export function isSeedAuthProvisionRequest(
  headers: Headers | undefined | null,
): boolean {
  const value = headers?.get(SEED_AUTH_PROVISION_HEADER)?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
