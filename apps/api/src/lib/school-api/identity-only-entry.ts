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

  async function verifiedIdentifiers() {
    const contact = await input.identityClient.directory.resolveBySubjectId(session.user.id);
    return contact?.identifiers ?? [];
  }

  async function matchingContact(invitation: AccountInvitation): Promise<string | undefined> {
    const kind = invitation.contactChannel === AccountInvitationContactChannel.Email ? "email" : "phone";
    const target = kind === "email" ? normalizeInvitationEmail(invitation.contactValue) : invitation.contactValue.trim().replace(/[ ().-]/g, "");
    return (await verifiedIdentifiers()).find(i => i.kind === kind && (kind === "email" ? normalizeInvitationEmail(i.value) : i.value) === target)?.value;
  }

  function invitationAcceptanceService(invitation: AccountInvitation) {
    if (selectedActor && actorBlocksInvitationAcceptance(selectedActor, invitation)) {
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
      const contactValue = await matchingContact(invitation);
      if (!contactValue) {
        throw new BusinessRuleViolationError("INVITATION_CONTACT_MISMATCH", "Sign in using an Account with the verified invitation contact");
      }
      return invitationAcceptanceService(invitation).accountInvitationWorkflow.acceptAccountInvitation({
        token,
        subjectId: session.user.id,
        contactValue,
      });
    },
    async listMyInvitations() {
      const emails = (await verifiedIdentifiers()).filter(i => i.kind === "email");
      const groups = await Promise.all(emails.map(i => schoolApp.repositories.accountInvitations.findPendingByContact({
        contactChannel: AccountInvitationContactChannel.Email,
        contactValue: i.value,
        kind: AccountInvitationKind.Guardian,
      })));
      return [...new Map(groups.flat().map(invitation => [invitation.id, invitation])).values()];
    },
    async acceptInvitationById(invitationId: string) {
      const invitation = await schoolApp.repositories.accountInvitations.findById(invitationId);
      if (!invitation || invitation.kind !== AccountInvitationKind.Guardian || invitation.contactChannel !== AccountInvitationContactChannel.Email || !await matchingContact(invitation))
        return null;
      return invitationAcceptanceService(invitation).accountInvitationWorkflow.acceptAccountInvitationById({
        invitationId: invitation.id,
        subjectId: session.user.id,
        contactValue: await matchingContact(invitation),
      });
    },
  });
}

function actorBlocksInvitationAcceptance(actor: ActorMetadata, invitation: AccountInvitation): boolean {
  if (!("schoolId" in actor) || actor.schoolId !== invitation.schoolId)
    return false;
  return !actorMatchesInvitationTarget(actor, invitation);
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
