/** Staging fixtures must never deliver to addresses outside the designated test set. */
export function allowStagingNotification(apiOrigin: string, email: string | undefined | null, allowlist: string): boolean {
  if (apiOrigin !== "https://staging.api.school.edayaplus.com")
    return true;
  const allowed = new Set(allowlist.split(",").map(value => value.trim().toLowerCase()).filter(Boolean));
  return !!email && allowed.has(email.trim().toLowerCase());
}
