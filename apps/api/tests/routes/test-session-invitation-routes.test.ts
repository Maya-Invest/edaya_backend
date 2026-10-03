import indexRouter from "@/app-router";
import type { AppBindings } from "@/http/types";
import { parseEnv } from "@/runtime";
import { ActorAssuranceLevel, createGuardianActorMetadata } from "@edaya/authorization";
import { AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus, Guardian } from "@edaya/core";
import { SEED_SCHOOL_ID } from "@edaya/fixtures/shared/ids";
import { hashInvitationToken } from "@edaya/service";
import { verifyIdentityToken } from "../../src/identity/server/index";
import type { IdentityClient } from "../../src/identity/server/index";
import { createTestIdentityKeys, signTestIdentityToken } from "../../src/identity/server/testing";
import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

const issuer = "http://localhost:9999";
const audience = "http://localhost:9999";
const keys = await createTestIdentityKeys();
const baseEnv = parseEnv({ RUNTIME: "in-memory", NODE_ENV: "test", DATABASE_URL: "pglite" });
const identityClient: IdentityClient = {
  directory: { lookupByContact: async () => undefined, async resolveBySubjectId(subjectId) {
    const value = subjectId === "unverified" ? undefined : subjectId === "other" ? "other@school.edu" : "guardian@school.edu";
    return value ? { identifiers: [{ kind: "email" as const, value }] } : undefined;
  } },
  verifyAccessToken: token => verifyIdentityToken(token, { issuer, audience, jwks: keys.jwks }),
};

const guardian = new Guardian({
  id: "guardian-9",
  schoolId: SEED_SCHOOL_ID,
  firstName: "Alice",
  lastName: "Parent",
  email: "guardian@school.edu",
});

function guardianInvitation(overrides: Partial<ConstructorParameters<typeof AccountInvitation>[0]> = {}) {
  return new AccountInvitation({
    id: "inv-session",
    schoolId: SEED_SCHOOL_ID,
    kind: AccountInvitationKind.Guardian,
    targetId: guardian.id,
    contactChannel: AccountInvitationContactChannel.Email,
    contactValue: "guardian@school.edu",
    tokenHash: hashInvitationToken("hidden-token"),
    status: AccountInvitationStatus.Pending,
    expiresAt: new Date("2026-12-31T00:00:00.000Z"),
    createdByStaffId: "staff-admin",
    ...overrides,
  });
}

function createApp(options: {
  invitations?: AccountInvitation[];
  actor?: ReturnType<typeof createGuardianActorMetadata> | null;
} = {}) {
  const invitations = options.invitations ?? [guardianInvitation()];
  const acceptAccountInvitationById = mock(async () => ({
    kind: "guardian" as const,
    entity: guardian,
  }));
  const acceptAccountInvitation = mock(async () => ({
    kind: "guardian" as const,
    entity: guardian,
  }));
  const app = new Hono<AppBindings>();
  app.use(async (c, next) => {
    c.env = baseEnv;
    c.set("identityClient", identityClient);
    c.set("actor", options.actor ?? null);
    c.set("schoolApp", {
      repositories: {
        accountInvitations: {
          findByTokenHash: async () => undefined,
          findById: async (id: string) => invitations.find(invitation => invitation.id === id),
          findPendingByContact: async (input: { contactValue: string; kind: string; contactChannel: string }) =>
            invitations.filter(invitation =>
              invitation.kind === input.kind
              && invitation.contactChannel === input.contactChannel
              && invitation.contactValue === input.contactValue
              && invitation.status === AccountInvitationStatus.Pending),
        },
        schools: {
          findById: async () => ({ id: SEED_SCHOOL_ID, name: "Demo School" }),
        },
        guardians: {
          findById: async (id: string) => (id === guardian.id ? guardian : undefined),
        },
      },
      forActor: () => ({ accountInvitationWorkflow: { acceptAccountInvitation, acceptAccountInvitationById } }),
    } as never);
    await next();
  });
  app.route("/", indexRouter);
  return { app, acceptAccountInvitationById };
}

async function tokenFor(options: { email?: string; emailVerified?: boolean } = {}) {
  return signTestIdentityToken(keys, {
    sub: options.emailVerified === false ? "unverified" : options.email === "other@school.edu" ? "other" : "identity-user-1",
    email: options.email ?? "guardian@school.edu",
    email_verified: options.emailVerified ?? true,
    iss: issuer,
    aud: audience,
  });
}

describe("session invitation routes", () => {
  it("returns 401 without a bearer JWT", async () => {
    const { app } = createApp();
    const list = await app.request("/public/me/invitations");
    const accept = await app.request("/public/me/invitations/inv-session/accept", { method: "POST" });
    expect(list.status).toBe(401);
    expect(accept.status).toBe(401);
  });

  it("lists pending guardian email invitations for all verified Account aliases", async () => {
    const { app } = createApp();
    const response = await app.request("/public/me/invitations", {
      headers: { authorization: `Bearer ${await tokenFor({ email: "primary@school.edu" })}` },
    });
    const body = await response.json() as { invitations: Array<{ id: string; schoolName: string; inviteeName: string; token?: string; targetId?: string }> };
    expect(response.status).toBe(200);
    expect(body.invitations).toEqual([
      expect.objectContaining({
        id: "inv-session",
        kind: "guardian",
        schoolName: "Demo School",
        inviteeName: "Alice Parent",
        contactChannel: "email",
      }),
    ]);
    expect(body.invitations[0]?.token).toBeUndefined();
    expect(body.invitations[0]?.targetId).toBeUndefined();
  });

  it("returns an empty list for unverified email, mismatched contact, or phone invites", async () => {
    const phoneInvite = guardianInvitation({
      id: "inv-phone",
      contactChannel: AccountInvitationContactChannel.Phone,
      contactValue: "+2250102030405",
    });
    const staffInvite = guardianInvitation({
      id: "inv-staff",
      kind: AccountInvitationKind.Staff,
      targetId: "staff-9",
    });
    const { app } = createApp({ invitations: [guardianInvitation(), phoneInvite, staffInvite] });

    const unverified = await app.request("/public/me/invitations", {
      headers: { authorization: `Bearer ${await tokenFor({ emailVerified: false })}` },
    });
    expect(unverified.status).toBe(200);
    expect(await unverified.json() as { invitations: unknown[] }).toEqual({ invitations: [] });

    const otherEmail = await app.request("/public/me/invitations", {
      headers: { authorization: `Bearer ${await tokenFor({ email: "other@school.edu" })}` },
    });
    expect(otherEmail.status).toBe(200);
    expect(await otherEmail.json() as { invitations: unknown[] }).toEqual({ invitations: [] });
  });

  it("accepts a matching verified guardian invitation by id", async () => {
    const { app, acceptAccountInvitationById } = createApp();
    const response = await app.request("/public/me/invitations/inv-session/accept", {
      method: "POST",
      headers: { authorization: `Bearer ${await tokenFor()}` },
    });
    expect(response.status).toBe(200);
    expect(acceptAccountInvitationById).toHaveBeenCalledWith({
      invitationId: "inv-session",
      subjectId: "identity-user-1",
      contactValue: "guardian@school.edu",
    });
  });

  it("returns 404 for staff invites, unknown ids, and unverified sessions", async () => {
    const staffInvite = guardianInvitation({
      id: "inv-staff",
      kind: AccountInvitationKind.Staff,
      targetId: "staff-9",
    });
    const { app, acceptAccountInvitationById } = createApp({ invitations: [staffInvite, guardianInvitation()] });

    const staff = await app.request("/public/me/invitations/inv-staff/accept", {
      method: "POST",
      headers: { authorization: `Bearer ${await tokenFor()}` },
    });
    expect(staff.status).toBe(404);

    const unknown = await app.request("/public/me/invitations/missing/accept", {
      method: "POST",
      headers: { authorization: `Bearer ${await tokenFor()}` },
    });
    expect(unknown.status).toBe(404);

    const unverified = await app.request("/public/me/invitations/inv-session/accept", {
      method: "POST",
      headers: { authorization: `Bearer ${await tokenFor({ emailVerified: false })}` },
    });
    expect(unverified.status).toBe(404);
    expect(acceptAccountInvitationById).not.toHaveBeenCalled();
  });

  it("returns 409 when the subject is already linked to a different actor", async () => {
    const actor = createGuardianActorMetadata({
      schoolId: SEED_SCHOOL_ID,
      subjectId: "identity-user-1",
      requestId: "req-1",
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Verified,
      guardianId: "guardian-other",
    });
    const { app } = createApp({ actor });
    const response = await app.request("/public/me/invitations/inv-session/accept", {
      method: "POST",
      headers: { authorization: `Bearer ${await tokenFor()}` },
    });
    expect(response.status).toBe(409);
  });
});
