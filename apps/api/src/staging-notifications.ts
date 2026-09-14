/** Staging fixtures must never deliver to addresses outside the designated test set. */
export function allowStagingNotification(apiOrigin: string, email: string | undefined | null, allowlist: string): boolean {
  if (apiOrigin !== "https://staging.school.api.edayaplus.com")
    return true;
  const allowed = new Set(allowlist.split(",").map(value => value.trim().toLowerCase()).filter(Boolean));
  return !!email && allowed.has(email.trim().toLowerCase());
}

/** Phone invitations are not email-allowlisted; Worker SMS is unimplemented so they cannot leak. */
export function allowStagingInvitation(
  apiOrigin: string,
  recipient: { contactChannel: "email" | "phone"; contactValue: string } | undefined,
  allowlist: string,
): boolean {
  if (!recipient)
    return false;
  if (recipient.contactChannel === "phone")
    return true;
  return allowStagingNotification(apiOrigin, recipient.contactValue, allowlist);
}
