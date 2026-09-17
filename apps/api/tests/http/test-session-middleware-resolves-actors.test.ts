import type { AppBindings } from "@/http/types";
import { createDependenciesInjection } from "@/http/dependencies";
import { createSessionActorDependency, resolveAuthenticatedSession } from "@/http/dependencies/session-actor";
import { createTestIdentityKeys, signTestIdentityToken } from "@maya-invest/edaya-identity-client/testing";
import { createDirectoryClient, verifyIdentityToken } from "@maya-invest/edaya-identity-client";
import type { IdentityClient } from "@maya-invest/edaya-identity-client";
import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

const issuer = "http://localhost:9900";
const audience = "http://localhost:9999";
const keys = await createTestIdentityKeys();
const identityClient: IdentityClient = {
  directory: createDirectoryClient({
    baseUrl: issuer,
    secret: "test",
    fetch: (async () => new Response(null, { status: 404 })) as unknown as typeof fetch,
  }),
  verifyAccessToken: token => verifyIdentityToken(token, {
    issuer,
    audience,
    jwks: keys.jwks,
  }),
};

describe("identity JWT session actor", () => {
  it("does not authenticate cookies on school routes", async () => {
    const headers = new Headers({ cookie: "better-auth.session_token=legacy" });
    expect(await resolveAuthenticatedSession(headers, identityClient)).toBeNull();
  });

  it("resolves an interactive actor from a verified JWT subject", async () => {
    const token = await signTestIdentityToken(keys, {
      sub: "identity-user-1",
      email: "staff@school.test",
      email_verified: true,
      iss: issuer,
      aud: audience,
    });
    const staff = {
      id: "staff-1",
      schoolId: "school-1",
      subjectId: "identity-user-1",
      accountKind: "human",
      isActive: true,
    };
    const repos: any = {
      staffMembers: {
        list: mock(async () => [staff]),
        findOne: mock(async () => staff),
        findById: mock(async () => staff),
      },
      guardians: { list: mock(async () => []), findOne: mock(async () => undefined) },
      students: { list: mock(async () => []), findOne: mock(async () => undefined) },
      teachers: { list: mock(async () => []), findOne: mock(async () => undefined) },
      staffAssignments: { list: mock(async () => []) },
      staffPermissionAssignments: { list: mock(async () => []) },
      serviceApiKeys: { findActiveByHash: mock(async () => undefined) },
      s2sClients: { findActiveByHash: mock(async () => undefined) },
      platformUsers: {
        findBySubjectId: mock(async () => undefined),
        findByEmail: mock(async () => undefined),
        save: mock(async (user: unknown) => user),
      },
    };

    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.set("identityClient", identityClient);
      c.set("schoolApp", { repositories: repos } as never);
      await next();
    });
    app.use(createDependenciesInjection([createSessionActorDependency()]));
    app.get("/", c => c.json({ actor: c.get("actor") }));

    const response = await app.request("/", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    expect((await response.json() as any).actor).toMatchObject({
      kind: "staff",
      subjectId: "identity-user-1",
      staffMemberId: "staff-1",
      schoolId: "school-1",
    });
  });

  it("does not authenticate API-key prefixes as identity JWTs", async () => {
    expect(await resolveAuthenticatedSession(
      new Headers({ authorization: "Bearer s2s_live_abcdefghijklmnop" }),
      identityClient,
    )).toBeNull();
    expect(await resolveAuthenticatedSession(
      new Headers({ authorization: "Bearer sk_live_abcdefghijklmnop" }),
      identityClient,
    )).toBeNull();
  });

  it("rejects a JWT with the wrong audience", async () => {
    const token = await signTestIdentityToken(keys, {
      sub: "identity-user-1",
      email: "staff@school.test",
      iss: issuer,
      aud: "http://wrong-audience.test",
    });
    expect(await resolveAuthenticatedSession(
      new Headers({ authorization: `Bearer ${token}` }),
      identityClient,
    )).toBeNull();
  });

  it("bootstraps a platform actor for an allowlisted JWT email", async () => {
    const token = await signTestIdentityToken(keys, {
      sub: "identity-op-1",
      email: "op@edaya.test",
      email_verified: true,
      iss: issuer,
      aud: audience,
    });
    const saved: unknown[] = [];
    const repos: any = {
      staffMembers: { list: mock(async () => []), findOne: mock(async () => undefined), findById: mock(async () => undefined) },
      guardians: { list: mock(async () => []), findOne: mock(async () => undefined) },
      students: { list: mock(async () => []), findOne: mock(async () => undefined) },
      teachers: { list: mock(async () => []), findOne: mock(async () => undefined) },
      serviceApiKeys: { findActiveByHash: mock(async () => undefined) },
      s2sClients: { findActiveByHash: mock(async () => undefined) },
      platformUsers: {
        findBySubjectId: mock(async () => undefined),
        findByEmail: mock(async () => undefined),
        save: mock(async (user: unknown) => {
          saved.push(user);
          return user;
        }),
      },
    };

    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = { PLATFORM_BOOTSTRAP_EMAILS: "op@edaya.test" } as AppBindings["Bindings"];
      c.set("identityClient", identityClient);
      c.set("schoolApp", { repositories: repos } as never);
      await next();
    });
    app.use(createDependenciesInjection([createSessionActorDependency()]));
    app.get("/", c => c.json({ actor: c.get("actor") }));

    const response = await app.request("/", {
      headers: {
        "authorization": `Bearer ${token}`,
        "x-actor-kind": "platform",
      },
    });
    expect(response.status).toBe(200);
    expect(saved).toHaveLength(1);
    expect((await response.json() as any).actor).toMatchObject({
      kind: "platform",
      subjectId: "identity-op-1",
      email: "op@edaya.test",
    });
  });
});
