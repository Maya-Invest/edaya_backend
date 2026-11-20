import { describe, expect, it } from "bun:test";
import { parseEnv } from "@/runtime";
import { AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus, StaffMember } from "@edaya/core";
import { hashInvitationToken } from "@edaya/service";
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
});

describe("invitation preview route", () => {
  it("returns invitation metadata for a valid token", async () => {
    const token = "preview-token-123";
    const invitation = new AccountInvitation({
      id: "inv-1",
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
    const staff = new StaffMember({
      id: "staff-9",
      schoolId: SEED_SCHOOL_ID,
      firstName: "Camille",
      lastName: "Moreau",
      email: "staff@school.edu",
    });

    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = baseEnv;
      c.set("schoolApp", {
        repositories: {
          accountInvitations: {
            findByTokenHash: async (hash: string) => (
              hash === hashInvitationToken(token) ? invitation : undefined
            ),
          },
          schools: {
            findById: async () => ({ id: SEED_SCHOOL_ID, name: "Demo School" }),
          },
          staffMembers: {
            findById: async (id: string) => (id === staff.id ? staff : undefined),
          },
        },
        hasAuthAccountForEmail: async () => true,
      } as never);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request(`/public/invitations/${token}`);
    const body = await res.json() as {
      status: string;
      kind: string;
      inviteeName: string;
      schoolName: string;
      contactEmail?: string;
      authAccountExists?: boolean;
    };

    expect(res.status).toBe(200);
    expect(body.inviteeName).toBe("Camille Moreau");
    expect(body.schoolName).toBe("Demo School");
    expect(body.contactEmail).toBe("staff@school.edu");
    expect(body).not.toHaveProperty("authAccountExists");
  });

  it("returns 404 when the invitation token is unknown", async () => {
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = baseEnv;
      c.set("schoolApp", {
        repositories: {
          accountInvitations: {
            findByTokenHash: async () => undefined,
          },
        },
      } as never);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request("/public/invitations/unknown-token");
    expect(res.status).toBe(404);
  });

  it("resolves invitee names for guardian and teacher invitations", async () => {
    const guardianToken = "guardian-token";
    const guardianInvitation = new AccountInvitation({
      id: "inv-guardian",
      schoolId: SEED_SCHOOL_ID,
      kind: AccountInvitationKind.Guardian,
      targetId: "guardian-1",
      contactChannel: AccountInvitationContactChannel.Phone,
      contactValue: "+33600000000",
      tokenHash: hashInvitationToken(guardianToken),
      status: AccountInvitationStatus.Pending,
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
      createdByStaffId: "staff-admin",
    });

    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = baseEnv;
      c.set("schoolApp", {
        repositories: {
          accountInvitations: {
            findByTokenHash: async (hash: string) => (
              hash === hashInvitationToken(guardianToken) ? guardianInvitation : undefined
            ),
          },
          schools: {
            findById: async () => ({ id: SEED_SCHOOL_ID, name: "Demo School" }),
          },
          guardians: {
            findById: async () => ({
              id: "guardian-1",
              schoolId: SEED_SCHOOL_ID,
              firstName: "Alice",
              lastName: "Parent",
            }),
          },
        },
        hasAuthAccountForEmail: async () => false,
        hasAuthAccountForPhone: async () => false,
      } as never);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request(`/public/invitations/${guardianToken}`);
    const body = await res.json() as {
      inviteeName: string;
      contactEmail?: string;
      contactPhone?: string;
      authAccountExists?: boolean;
    };

    expect(res.status).toBe(200);
    expect(body.inviteeName).toBe("Alice Parent");
    expect(body.contactEmail).toBeUndefined();
    expect(body.contactPhone).toBe("+33600000000");
    expect(body.authAccountExists).toBe(false);
  });
});
