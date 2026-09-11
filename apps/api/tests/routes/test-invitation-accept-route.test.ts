import indexRouter from "@/app-router";
import type { AppBindings } from "@/http/types";
import { parseEnv } from "@/runtime";
import { ActorAssuranceLevel, createStaffActorMetadata } from "@edaya/authorization";
import { AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus, type Permission, StaffMember } from "@edaya/core";
import { SEED_SCHOOL_ID } from "@edaya/fixtures/shared/ids";
import { hashInvitationToken } from "@edaya/service";
import { createDirectoryClient, type IdentityClient, verifyIdentityToken } from "@maya-invest/edaya-identity-client";
import { createTestIdentityKeys, signTestIdentityToken } from "@maya-invest/edaya-identity-client/testing";
import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

const issuer = "http://localhost:9900";
const audience = "http://localhost:9999";
const keys = await createTestIdentityKeys();
const baseEnv = parseEnv({ RUNTIME: "in-memory", NODE_ENV: "test", DATABASE_URL: "pglite" });
const identityClient: IdentityClient = {
  directory: createDirectoryClient({
    baseUrl: issuer,
    secret: "test",
    fetch: (async () => new Response(null, { status: 404 })) as unknown as typeof fetch,
  }),
  verifyAccessToken: token => verifyIdentityToken(token, { issuer, audience, jwks: keys.jwks }),
};

function staffInvitation(token: string) {
  return new AccountInvitation({
    id: "inv-accept",
    schoolId: SEED_SCHOOL_ID,
    kind: AccountInvitationKind.Staff,
    targetId: "staff-9",
    contactChannel: AccountInvitationContactChannel.Email,
    contactValue: "staff@school.edu",
    tokenHash: hashInvitationToken(token),
    status: AccountInvitationStatus.Pending,
    expiresAt: new Date("2026-12-31T00:00:00.000Z"),
    createdByStaffId: "staff-admin",
  });
}

function createInvitationApp(
  token: string,
  actor: ReturnType<typeof createStaffActorMetadata> | null = null,
  invitation: AccountInvitation = staffInvitation(token),
) {
  const acceptAccountInvitation = mock(async () => ({
    kind: "staff" as const,
    entity: new StaffMember({
      id: "staff-9",
      schoolId: SEED_SCHOOL_ID,
      firstName: "Camille",
      lastName: "Moreau",
      email: "staff@school.edu",
      subjectId: "identity-user-1",
    }),
  }));
  const app = new Hono<AppBindings>();
  app.use(async (c, next) => {
    c.env = baseEnv;
    c.set("identityClient", identityClient);
    c.set("actor", actor);
    c.set("schoolApp", {
      repositories: {
        accountInvitations: {
          findByTokenHash: async (hash: string) => hash === hashInvitationToken(token) ? invitation : undefined,
        },
      },
      forActor: () => ({ accountInvitationWorkflow: { acceptAccountInvitation } }),
    } as never);
    await next();
  });
  app.route("/", indexRouter);
  return { app, acceptAccountInvitation };
}

async function tokenFor(email?: string) {
  return signTestIdentityToken(keys, {
    sub: "identity-user-1",
    ...(email ? { email } : { phone: "+2250102030405" }),
    iss: issuer,
    aud: audience,
  });
}

describe("invitation accept route", () => {
  it("accepts a matching identity JWT", async () => {
    const invitationToken = "accept-token-123";
    const { app, acceptAccountInvitation } = createInvitationApp(invitationToken);
    const jwt = await tokenFor("staff@school.edu");
    const response = await app.request(`/public/invitations/${invitationToken}/accept`, {
      method: "POST",
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(response.status).toBe(200);
    expect(acceptAccountInvitation).toHaveBeenCalledWith({
      token: invitationToken,
      subjectId: "identity-user-1",
      contactValue: "staff@school.edu",
    });
  });

  it("passes a matching identity phone claim to the invitation workflow", async () => {
    const invitationToken = "accept-phone-token";
    const invitation = new AccountInvitation({
      id: "inv-phone",
      schoolId: SEED_SCHOOL_ID,
      kind: AccountInvitationKind.Guardian,
      targetId: "guardian-9",
      contactChannel: AccountInvitationContactChannel.Phone,
      contactValue: "+2250102030405",
      tokenHash: hashInvitationToken(invitationToken),
      status: AccountInvitationStatus.Pending,
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
      createdByStaffId: "staff-admin",
    });
    const { app, acceptAccountInvitation } = createInvitationApp(invitationToken, null, invitation);
    const response = await app.request(`/public/invitations/${invitationToken}/accept`, {
      method: "POST",
      headers: { authorization: `Bearer ${await tokenFor()}` },
    });

    expect(response.status).toBe(200);
    expect(acceptAccountInvitation).toHaveBeenCalledWith({
      token: invitationToken,
      subjectId: "identity-user-1",
      contactValue: "+2250102030405",
    });
  });

  it("returns 401 without a bearer JWT", async () => {
    const { app } = createInvitationApp("accept-token-no-auth");
    const response = await app.request("/public/invitations/accept-token-no-auth/accept", { method: "POST" });
    expect(response.status).toBe(401);
  });

  it("returns 409 when the subject is linked to a different actor", async () => {
    const actor = createStaffActorMetadata({
      schoolId: SEED_SCHOOL_ID,
      subjectId: "identity-user-1",
      requestId: "req-1",
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Standard,
      staffMemberId: "staff-other",
      effectiveGrants: { permissions: new Set<Permission>(), scopeGrants: [], scopeIdsByPermission: {}, isElevated: false },
    });
    const { app } = createInvitationApp("accept-token-conflict", actor);
    const jwt = await tokenFor("staff@school.edu");
    const response = await app.request("/public/invitations/accept-token-conflict/accept", {
      method: "POST",
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(response.status).toBe(409);
  });
});
