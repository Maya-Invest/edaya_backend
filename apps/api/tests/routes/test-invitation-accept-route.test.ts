import { describe, expect, it, mock } from "bun:test";
import { parseEnv } from "@/runtime";
import type {
  Permission,
} from "@edaya/core";
import {
  AccountInvitation,
  AccountInvitationContactChannel,
  AccountInvitationKind,
  AccountInvitationStatus,
  ActorAssuranceLevel,
  createStaffActorMetadata,
  hashInvitationToken,
  StaffMember,
} from "@edaya/core";
import type { AppBindings } from "@/http/types";
import indexRouter from "@/app-router";
import { Hono } from "hono";
import { SEED_SCHOOL_ID } from "@edaya/fixtures/shared/ids";

const baseEnv = parseEnv({
  RUNTIME: "in-memory",
  NODE_ENV: "test",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgres://admin:admin@localhost:5432/test_db",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
});

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

function createInvitationApp(options: {
  token: string;
  invitation?: AccountInvitation;
  actor?: ReturnType<typeof createStaffActorMetadata> | null;
  session?: {
    user: { id: string; email?: string | null };
    session: { createdAt: string };
  } | null;
  acceptAccountInvitation?: ReturnType<typeof mock>;
}) {
  const invitation = options.invitation ?? staffInvitation(options.token);
  const acceptAccountInvitation = options.acceptAccountInvitation ?? mock(async () => ({
    kind: "staff" as const,
    entity: new StaffMember({
      id: "staff-9",
      schoolId: SEED_SCHOOL_ID,
      firstName: "Camille",
      lastName: "Moreau",
      email: "staff@school.edu",
      subjectId: "auth-user-1",
    }),
  }));

  const app = new Hono<AppBindings>();
  app.use(async (c, next) => {
    c.env = baseEnv;
    c.set("auth", {
      api: {
        getSession: async () => options.session ?? null,
      },
      handler: async () => new Response(null, { status: 404 }),
    } as never);
    c.set("actor", options.actor ?? null);
    c.set("schoolApp", {
      repositories: {
        accountInvitations: {
          findByTokenHash: async (hash: string) => (
            hash === hashInvitationToken(options.token) ? invitation : undefined
          ),
        },
      },
      forActor: () => ({
        accountInvitationWorkflow: {
          acceptAccountInvitation,
        },
      }),
    } as never);
    await next();
  });
  app.route("/", indexRouter);

  return { app, acceptAccountInvitation };
}

describe("invitation accept route", () => {
  it("accepts an invitation for a signed-in user and returns the linked actor", async () => {
    const token = "accept-token-123";
    const { app, acceptAccountInvitation } = createInvitationApp({
      token,
      session: {
        user: { id: "auth-user-1", email: "staff@school.edu" },
        session: { createdAt: "2026-01-01T00:00:00.000Z" },
      },
    });

    const res = await app.request(`/public/invitations/${token}/accept`, { method: "POST" });
    const body = await res.json() as {
      kind: string;
      entity: { id: string; subjectId: string };
    };

    expect(res.status).toBe(200);
    expect(body.kind).toBe("staff");
    expect(body.entity.id).toBe("staff-9");
    expect(body.entity.subjectId).toBe("auth-user-1");
    expect(acceptAccountInvitation).toHaveBeenCalledWith({
      token,
      subjectId: "auth-user-1",
      contactEmail: "staff@school.edu",
    });
  });

  it("returns 401 when the auth session has no email", async () => {
    const token = "accept-token-no-email";
    const { app } = createInvitationApp({
      token,
      session: {
        user: { id: "auth-user-1", email: null },
        session: { createdAt: "2026-01-01T00:00:00.000Z" },
      },
    });

    const res = await app.request(`/public/invitations/${token}/accept`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("returns 409 when the signed-in actor is linked to a different target", async () => {
    const token = "accept-token-conflict";
    const actor = createStaffActorMetadata({
      schoolId: SEED_SCHOOL_ID,
      subjectId: "auth-user-2",
      requestId: "req-1",
      authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
      assuranceLevel: ActorAssuranceLevel.Standard,
      staffMemberId: "staff-other",
      effectiveGrants: {
        permissions: new Set<Permission>(),
        scopeGrants: [],
        scopeIdsByPermission: {},
        isElevated: false,
      },
    });
    const { app } = createInvitationApp({
      token,
      actor,
      session: {
        user: { id: "auth-user-2", email: "other@school.edu" },
        session: { createdAt: "2026-01-01T00:00:00.000Z" },
      },
    });

    const res = await app.request(`/public/invitations/${token}/accept`, { method: "POST" });
    expect(res.status).toBe(409);
  });
});
