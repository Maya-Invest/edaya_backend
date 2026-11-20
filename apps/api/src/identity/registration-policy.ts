import type { AccountInvitation } from "@edaya/core";
import { AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus } from "@edaya/core";
import { normalizeInvitationEmail } from "@edaya/service";
import type { ApiSchoolApplication } from "@/lib/school-api/application";

const kinds = [AccountInvitationKind.Staff, AccountInvitationKind.Teacher, AccountInvitationKind.Guardian];
const contactChannel = AccountInvitationContactChannel.Email;

export function invitedEmailPolicy(school: () => Promise<ApiSchoolApplication>) {
  return async (email: string, tokenHash?: string) => {
    const store = (await school()).repositories.accountInvitations;
    const matches = (invitation: AccountInvitation) => invitation.status === AccountInvitationStatus.Pending
      && invitation.expiresAt.getTime() > Date.now() && kinds.includes(invitation.kind)
      && invitation.contactChannel === contactChannel && normalizeInvitationEmail(invitation.contactValue) === email;
    if (tokenHash) {
      const invitation = await store.findByTokenHash(tokenHash);
      return invitation && matches(invitation) ? invitation.tokenHash : undefined;
    }
    const candidates = await Promise.all(kinds.map(kind => store.findPendingByContact({ contactChannel, contactValue: email, kind })));
    return candidates.flat().find(matches)?.tokenHash;
  };
}
