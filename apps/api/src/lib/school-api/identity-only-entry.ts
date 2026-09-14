import type { ActorMetadata } from "@edaya/authorization";
import type { AccountInvitation } from "@edaya/core";
import type { SchoolService } from "@edaya/service";
import type { IdentityClient } from "@maya-invest/edaya-identity-client";
import type { ApiSchoolApplication } from "./application";
import { createSystemActorMetadata } from "@edaya/authorization";
import { AccountInvitationContactChannel, AccountInvitationKind, BusinessRuleViolationError } from "@edaya/core";
import { hashInvitationToken } from "@edaya/service";
import { randomUUID } from "node:crypto";
import { resolveAuthenticatedSession } from "@/http/dependencies/session-actor";

type InvitationAcceptance = Awaited<ReturnType<SchoolService["accountInvitationWorkflow"]["acceptAccountInvitation"]>>;

/** Request-local capabilities before school-profile linkage. No school service or authority is exposed. */
export interface IdentityOnlyEntry {
  acceptInvitation: (token: string) => Promise<InvitationAcceptance | null>;
}

export async function admitIdentityOnlyEntry(input: {
  headers: Headers;
  identityClient: IdentityClient;
  schoolApp: ApiSchoolApplication;
  selectedActor: ActorMetadata | null;
}): Promise<IdentityOnlyEntry | null> {
  const session = await resolveAuthenticatedSession(input.headers, input.identityClient);
  if (!session)
    return null;
  const requestId = randomUUID();
  const { schoolApp, selectedActor } = input;
  return Object.freeze({
    async acceptInvitation(token: string) {
      const invitation = await schoolApp.repositories.accountInvitations.findByTokenHash(hashInvitationToken(token));
      if (!invitation)
        return null;
      if (selectedActor && !actorMatchesInvitationTarget(selectedActor, invitation)) {
        throw new BusinessRuleViolationError("SUBJECT_ALREADY_LINKED", "This account is already linked to a school actor");
      }
      // The credential's persisted record selects the school; request headers never do.
      // The existing workflow rechecks token/contact/lifecycle and writes inside its transaction.
      const service = schoolApp.forActor(createSystemActorMetadata({
        schoolId: invitation.schoolId,
        systemId: "account-invitation-public",
        requestId,
        reason: "public-invitation-accept",
      }));
      return service.accountInvitationWorkflow.acceptAccountInvitation({
        token,
        subjectId: session.user.id,
        contactValue: invitation.contactChannel === AccountInvitationContactChannel.Email ? session.user.email : session.user.phone,
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
