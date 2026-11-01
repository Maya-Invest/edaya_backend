import { AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus } from "@edaya/core";
import { normalizeInvitationEmail } from "@edaya/service";
import type { ApiSchoolApplication } from "@/lib/school-api/application";

export function invitedEmailPolicy(school: () => Promise<ApiSchoolApplication>) {
  return async (email: string, tokenHash: string) => {
    const invitation = await (await school()).repositories.accountInvitations.findByTokenHash(tokenHash);
    return !!invitation && invitation.status === AccountInvitationStatus.Pending
      && invitation.expiresAt.getTime() > Date.now()
      && [AccountInvitationKind.Staff, AccountInvitationKind.Teacher, AccountInvitationKind.Guardian].includes(invitation.kind)
      && invitation.contactChannel === AccountInvitationContactChannel.Email
      && normalizeInvitationEmail(invitation.contactValue) === email;
  };
}
