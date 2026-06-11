import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { parseEnv } from "@/lib/runtime/env";
import { ActorAssuranceLevel, Permission } from "@edaya/core";
import type { AppBindings } from "@/lib/http/types";
import indexRouter from "@/app-router";

const baseEnv = parseEnv({
  RUNTIME: "node",
  NODE_ENV: "test",
  PORT: 9999,
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgres://admin:admin@localhost:5432/test_db",
  BETTER_AUTH_SECRET: "super-secret-placeholder-key-for-local-testing",
  BETTER_AUTH_URL: "http://localhost:9999",
});

describe("authorization routes", () => {
  const mockActor = {
    kind: "staff" as const,
    actorId: "staff-1",
    subjectId: "admin-user",
    schoolId: "school-1",
    staffMemberId: "staff-1",
    effectiveGrants: {
      permissions: new Set<Permission>([Permission.STUDENT_READ]),
      scopeGrants: [{
        permission: Permission.STUDENT_READ,
        scopeType: "school" as const,
        scopeEntityIds: ["school-1"],
      }],
      isElevated: false,
    },
    requestId: "request-id",
    authenticatedAt: new Date("2026-01-01T00:00:00Z"),
    assuranceLevel: ActorAssuranceLevel.Standard,
  };

  it("returns serialized effective grants for the current actor", async () => {
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = baseEnv;
      c.set("actor", mockActor);
      c.set("schoolApp", { forActor: () => ({}) } as any);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request("/api/core/authorization/effective-grants");
    const body = await res.json() as {
      kind: string;
      actorId: string;
      schoolId: string;
      effectiveGrants: {
        permissions: string[];
        scopeGrants: unknown[];
        isElevated: boolean;
      };
    };

    expect(res.status).toBe(200);
    expect(body.kind).toBe("staff");
    expect(body.actorId).toBe("staff-1");
    expect(body.effectiveGrants.permissions).toContain("STUDENT_READ");
    expect(body.effectiveGrants.scopeGrants).toHaveLength(1);
  });

  it("returns 401 when no actor is present", async () => {
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = baseEnv;
      c.set("actor", null);
      c.set("schoolApp", { forActor: () => ({}) } as any);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request("/api/core/authorization/effective-grants");
    expect(res.status).toBe(401);
  });
});

describe("system actor routes", () => {
  it("returns 503 when system actor routes are disabled", async () => {
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = baseEnv;
      c.set("schoolApp", { forActor: () => ({ registerSchool: mock().mockResolvedValue({ id: "school-1" }) }) } as any);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request("/api/core/system/commands/register-school", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: "school-1",
        systemId: "migration",
        reason: "bootstrap",
        payload: {},
      }),
    });

    expect(res.status).toBe(503);
  });

  it("executes a command when the system actor secret is valid", async () => {
    const registerSchool = mock().mockResolvedValue({ id: "school-1", name: "Demo School" });
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = {
        ...baseEnv,
        SYSTEM_ACTOR_SECRET: "test-system-secret",
      };
      c.set("schoolApp", { forActor: () => ({ registerSchool }) } as any);
      await next();
    });
    app.route("/", indexRouter);

    const res = await app.request("/api/core/system/commands/register-school", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-System-Actor-Secret": "test-system-secret",
      },
      body: JSON.stringify({
        schoolId: "school-1",
        systemId: "migration",
        reason: "bootstrap",
        payload: { id: "school-1", name: "Demo School" },
      }),
    });

    expect(res.status).toBe(200);
    expect(registerSchool).toHaveBeenCalled();
  });
});
