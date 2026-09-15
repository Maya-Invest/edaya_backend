import type { ActorMetadata } from "@edaya/authorization";
import type { AccountInvitation } from "@edaya/core";
import type { SchoolService } from "@edaya/service";
import type { IdentityClient } from "@maya-invest/edaya-identity-client";
import type { ApiSchoolApplication } from "./application";
import { createSystemActorMetadata } from "@edaya/authorization";
import { AccountInvitationContactChannel, AccountInvitationKind, BusinessRuleViolationError } from "@edaya/core";
import { hashInvitationToken, normalizeInvitationEmail } from "@edaya/service";
import { randomUUID } from "node:crypto";
import { resolveAuthenticatedSession } from "@/http/dependencies/session-actor";

type InvitationAcceptance = Awaited<ReturnType<SchoolService["accountInvitationWorkflow"]["acceptAccountInvitation"]>>;

/** Request-local capabilities before school-profile linkage. No school service or authority is exposed. */
export interface IdentityOnlyEntry {
  acceptInvitation: (token: string) => Promise<InvitationAcceptance | null>;
  listMyInvitations: () => Promise<AccountInvitation[]>;
  acceptInvitationById: (invitationId: string) => Promise<InvitationAcceptance | null>;
}

export async function admitIdentityOnlyEntry(input: {
  headers: Headers;
  identityClient: IdentityClient;
  schoolApp: ApiSchoolApplication;
  selectedActor: ActorMetadata | null;
}): Promise<IdentityOnlyEntry | null> {
  const resolved = await resolveAuthenticatedSession(input.headers, input.identityClient);
  if (!resolved)
    return null;
  const session = resolved;
  const requestId = randomUUID();
  const { schoolApp, selectedActor } = input;

  function sessionEmail(): string | undefined {
    return normalizeInvitationEmail(session.user.email);
  }

  function isVerifiedEmailSession(): boolean {
    return session.user.emailVerified === true && sessionEmail() !== undefined;
  }

  function isSessionGuardianEmailInvite(invitation: AccountInvitation): boolean {
    if (invitation.kind !== AccountInvitationKind.Guardian)
      return false;
    if (invitation.contactChannel !== AccountInvitationContactChannel.Email)
      return false;
    if (!isVerifiedEmailSession())
      return false;
    return normalizeInvitationEmail(invitation.contactValue) === sessionEmail();
  }

  function invitationAcceptanceService(invitation: AccountInvitation) {
    if (selectedActor && !actorMatchesInvitationTarget(selectedActor, invitation)) {
      throw new BusinessRuleViolationError("SUBJECT_ALREADY_LINKED", "This account is already linked to a school actor");
    }
    // The credential's persisted record selects the school; request headers never do.
    // The existing workflow rechecks token/contact/lifecycle and writes inside its transaction.
    return schoolApp.forActor(createSystemActorMetadata({
      schoolId: invitation.schoolId,
      systemId: "account-invitation-public",
      requestId,
      reason: "public-invitation-accept",
    }));
  }

  return Object.freeze({
    async acceptInvitation(token: string) {
      const invitation = await schoolApp.repositories.accountInvitations.findByTokenHash(hashInvitationToken(token));
      if (!invitation)
        return null;
      return invitationAcceptanceService(invitation).accountInvitationWorkflow.acceptAccountInvitation({
        token,
        subjectId: session.user.id,
        contactValue: invitation.contactChannel === AccountInvitationContactChannel.Email ? session.user.email : session.user.phone,
      });
    },
    async listMyInvitations() {
      const email = sessionEmail();
      if (!isVerifiedEmailSession() || !email)
        return [];
      return schoolApp.repositories.accountInvitations.findPendingByContact({
        contactChannel: AccountInvitationContactChannel.Email,
        contactValue: email,
        kind: AccountInvitationKind.Guardian,
      });
    },
    async acceptInvitationById(invitationId: string) {
      const invitation = await schoolApp.repositories.accountInvitations.findById(invitationId);
      if (!invitation || !isSessionGuardianEmailInvite(invitation))
        return null;
      return invitationAcceptanceService(invitation).accountInvitationWorkflow.acceptAccountInvitationById({
        invitationId: invitation.id,
        subjectId: session.user.id,
        contactValue: session.user.email,
      });
    },
  });
}

function actorMatchesInvitationTarget(actor: ActorMetadata, invitation: AccountInvitation): boolean {
  if (!("schoolId" in actor) || actor.schoolId !== invitation.schoolId)
    return false;
  switch (invitation.kind) {
    case AccountInvitationKind.Staff:
      return actor.kind === "staff" && actor.staffMemberId === invitation.targetId;
    case AccountInvitationKind.Guardian:
      return actor.kind === "guardian" && actor.guardianId === invitation.targetId;
    case AccountInvitationKind.Student:
      return actor.kind === "student" && actor.studentId === invitation.targetId;
    case AccountInvitationKind.Teacher:
      return actor.kind === "teacher" && actor.teacherId === invitation.targetId;
  }
}
