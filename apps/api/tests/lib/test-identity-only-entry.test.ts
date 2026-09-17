import type { ApiSchoolApplication } from "@/lib/school-api/application";
import type { ActorMetadata } from "@edaya/authorization";
import type { IdentityClient } from "@maya-invest/edaya-identity-client";
import { admitIdentityOnlyEntry } from "@/lib/school-api/identity-only-entry";
import { createGuardianActorMetadata, createStaffActorMetadata } from "@edaya/authorization";
import { AccountInvitationContactChannel, AccountInvitationKind } from "@edaya/core";
import { hashInvitationToken } from "@edaya/service";
import { verifyIdentityToken } from "@maya-invest/edaya-identity-client";
import { createTestIdentityKeys, signTestIdentityToken } from "@maya-invest/edaya-identity-client/testing";
import { describe, expect, it, mock } from "bun:test";

const issuer = "https://identity.example.test";
const audience = "https://school.example.test";
const keys = await createTestIdentityKeys();
const identityClient = {
  verifyAccessToken: (token: string) => verifyIdentityToken(token, { issuer, audience, jwks: keys.jwks }),
} as IdentityClient;

async function headers(aud = audience, expSeconds = 900) {
  const token = await signTestIdentityToken(keys, { sub: "verified-subject", email: "guardian@example.test", email_verified: true, iss: issuer, aud, expSeconds });
  return new Headers({ "authorization": `Bearer ${token}`, "x-school-id": "forged-school", "x-actor-id": "forged-owner", "x-actor-kind": "staff" });
}

function fixture() {
  const accept = mock(async (_input: { token: string; subjectId: string; contactValue?: string }) => ({ kind: "guardian", entity: { id: "guardian" } }));
  const acceptById = mock(async (_input: { invitationId: string; subjectId: string; contactValue?: string }) => ({ kind: "guardian", entity: { id: "guardian" } }));
  const forActor = mock((_actor: ActorMetadata) => ({
    accountInvitationWorkflow: { acceptAccountInvitation: accept, acceptAccountInvitationById: acceptById },
  }));
  const invitation = {
    id: "inv-guardian",
    schoolId: "credential-school",
    targetId: "guardian",
    kind: AccountInvitationKind.Guardian,
    contactChannel: AccountInvitationContactChannel.Email,
    contactValue: "guardian@example.test",
  };
  const find = mock(async (hash: string) => hash === hashInvitationToken("valid-credential") ? invitation : undefined);
  const findById = mock(async (id: string) => id === invitation.id ? invitation : undefined);
  const findPendingByContact = mock(async () => [invitation]);
  return {
    accept,
    acceptById,
    forActor,
    find,
    findById,
    findPendingByContact,
    invitation,
    schoolApp: {
      repositories: {
        accountInvitations: { findByTokenHash: find, findById, findPendingByContact },
      },
      forActor,
    } as unknown as ApiSchoolApplication,
  };
}

describe("identity-only admitted entry", () => {
  it("admits an unlinked identity with only the named operation and credential-derived school", async () => {
    const f = fixture();
    const entry = await admitIdentityOnlyEntry({ headers: await headers(), identityClient, schoolApp: f.schoolApp, selectedActor: null });
    expect(Object.keys(entry!)).toEqual(["acceptInvitation", "listMyInvitations", "acceptInvitationById"]);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(f.find).not.toHaveBeenCalled();
    expect(f.forActor).not.toHaveBeenCalled();
    expect(await entry!.acceptInvitation("unknown")).toBeNull();
    expect(f.forActor).not.toHaveBeenCalled();
    expect(await entry!.acceptInvitation("valid-credential")).toMatchObject({ kind: "guardian" });
    expect(f.forActor.mock.calls[0]![0]).toMatchObject({ kind: "system", schoolId: "credential-school", systemId: "account-invitation-public" });
    expect(f.accept.mock.calls[0]![0]).toEqual({ token: "valid-credential", subjectId: "verified-subject", contactValue: "guardian@example.test" });
  });

  it("rejects anonymous, service-key and wrongly addressed identities before credential lookup", async () => {
    const f = fixture();
    for (const requestHeaders of [new Headers(), new Headers({ cookie: "better-auth.session_token=legacy" }), new Headers({ authorization: "Bearer sk_live_abcdefghijklmnop" }), new Headers({ authorization: "Bearer s2s_live_abcdefghijklmnop" }), await headers("https://wrong-audience.example.test"), await headers(audience, -60)]) {
      expect(await admitIdentityOnlyEntry({ headers: requestHeaders, identityClient, schoolApp: f.schoolApp, selectedActor: null })).toBeNull();
    }
    expect(f.find).not.toHaveBeenCalled();
    expect(f.forActor).not.toHaveBeenCalled();
  });

  it("allows accepting an invitation into another school while already linked", async () => {
    const f = fixture();
    const selectedActor = createStaffActorMetadata({ schoolId: "other-school", staffMemberId: "staff-home", subjectId: "verified-subject", requestId: "test", authenticatedAt: new Date() });
    const entry = await admitIdentityOnlyEntry({ headers: await headers(), identityClient, schoolApp: f.schoolApp, selectedActor });
    expect(await entry!.acceptInvitation("valid-credential")).toMatchObject({ kind: "guardian" });
    expect(f.forActor.mock.calls[0]![0]).toMatchObject({ kind: "system", schoolId: "credential-school" });
  });

  it("rejects a different target in the same school", async () => {
    const f = fixture();
    const selectedActor = createGuardianActorMetadata({ schoolId: "credential-school", guardianId: "other-guardian", subjectId: "verified-subject", requestId: "test", authenticatedAt: new Date() });
    const entry = await admitIdentityOnlyEntry({ headers: await headers(), identityClient, schoolApp: f.schoolApp, selectedActor });
    await expect(entry!.acceptInvitation("valid-credential")).rejects.toMatchObject({ code: "SUBJECT_ALREADY_LINKED" });
    expect(f.forActor).not.toHaveBeenCalled();
  });

  it("lists and accepts pending guardian email invitations for a verified session", async () => {
    const f = fixture();
    const entry = await admitIdentityOnlyEntry({ headers: await headers(), identityClient, schoolApp: f.schoolApp, selectedActor: null });
    expect(await entry!.listMyInvitations()).toEqual([f.invitation as never]);
    expect(f.findPendingByContact).toHaveBeenCalledWith({
      contactChannel: AccountInvitationContactChannel.Email,
      contactValue: "guardian@example.test",
      kind: AccountInvitationKind.Guardian,
    });
    expect(await entry!.acceptInvitationById("inv-guardian")).toMatchObject({ kind: "guardian" });
    expect(f.acceptById.mock.calls[0]![0]).toEqual({
      invitationId: "inv-guardian",
      subjectId: "verified-subject",
      contactValue: "guardian@example.test",
    });
    expect(await entry!.acceptInvitationById("unknown")).toBeNull();
  });

  it("hides session invitations when email is not verified", async () => {
    const f = fixture();
    const token = await signTestIdentityToken(keys, { sub: "verified-subject", email: "guardian@example.test", email_verified: false, iss: issuer, aud: audience });
    const entry = await admitIdentityOnlyEntry({
      headers: new Headers({ authorization: `Bearer ${token}` }),
      identityClient,
      schoolApp: f.schoolApp,
      selectedActor: null,
    });
    expect(await entry!.listMyInvitations()).toEqual([]);
    expect(f.findPendingByContact).not.toHaveBeenCalled();
    expect(await entry!.acceptInvitationById("inv-guardian")).toBeNull();
    expect(f.forActor).not.toHaveBeenCalled();
  });
});
