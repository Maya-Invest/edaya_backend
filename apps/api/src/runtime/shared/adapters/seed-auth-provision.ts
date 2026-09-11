/** Intent marker on the local-only seed endpoint; never authentication authority. */
export const SEED_AUTH_PROVISION_HEADER = "x-edaya-seed-provision";

export function isSeedAuthProvisionRequest(
  headers: Headers | undefined | null,
): boolean {
  const value = headers?.get(SEED_AUTH_PROVISION_HEADER)?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
