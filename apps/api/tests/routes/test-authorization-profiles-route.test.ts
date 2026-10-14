import indexRouter from "@/app-router";
import type { AppBindings } from "@/http/types";
import { parseEnv } from "@/runtime";
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
  directory: { lookupByContact: async () => undefined, resolveBySubjectId: async () => undefined },
  verifyAccessToken: token => verifyIdentityToken(token, { issuer, audience, jwks: keys.jwks }),
};

function createProfilesApp() {
  const staffList = mock(async () => [
    { id: "staff-a", schoolId: "school-a", subjectId: "identity-user-1" },
    { id: "staff-b", schoolId: "school-b", subjectId: "identity-user-1" },
  ]);
  const emptyList = mock(async () => []);
  const findByIds = mock(async (ids: string[]) => [
    { id: "school-a", name: "Lycée — Cocody", shortName: "Saved name" },
    { id: "school-b", name: "Campus Nord", shortName: "Campus" },
  ].filter(school => ids.includes(school.id)));

  const app = new Hono<AppBindings>();
  app.use(async (c, next) => {
    c.env = baseEnv;
    c.set("identityClient", identityClient);
    c.set("actor", null);
    c.set("schoolApp", {
      repositories: {
        staffMembers: { list: staffList },
        guardians: { list: emptyList },
        students: { list: emptyList },
        teachers: { list: emptyList },
        schools: { findByIds },
      },
    } as never);
    await next();
  });
  app.route("/", indexRouter);
  return { app, staffList };
}

describe("authorization profiles route", () => {
  it("lists every staff school for a JWT without actor headers", async () => {
    const { app, staffList } = createProfilesApp();
    const jwt = await signTestIdentityToken(keys, {
      sub: "identity-user-1",
      email: "staff@school.test",
      iss: issuer,
      aud: audience,
    });
    const response = await app.request("/core/authorization/profiles", {
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(response.status).toBe(200);
    expect(staffList).toHaveBeenCalledWith({ subjectId: "identity-user-1" });
    expect(await response.json() as {
      profiles: Array<{
        kind: string;
        actorId: string;
        schoolId: string;
        schoolName: string;
        schoolShortName: string;
      }>;
    }).toEqual({
      profiles: [
        {
          kind: "staff",
          actorId: "staff-a",
          schoolId: "school-a",
          schoolName: "Lycée — Cocody",
          schoolShortName: "Saved name",
        },
        {
          kind: "staff",
          actorId: "staff-b",
          schoolId: "school-b",
          schoolName: "Campus Nord",
          schoolShortName: "Campus",
        },
      ],
    });
  });

  it("returns an empty profile list for an unlinked identity", async () => {
    const app = new Hono<AppBindings>();
    app.use(async (c, next) => {
      c.env = baseEnv;
      c.set("identityClient", identityClient);
      c.set("actor", null);
      c.set("schoolApp", {
        repositories: {
          staffMembers: { list: async () => [] },
          guardians: { list: async () => [] },
          students: { list: async () => [] },
          teachers: { list: async () => [] },
          schools: { findByIds: async () => [] },
        },
      } as never);
      await next();
    });
    app.route("/", indexRouter);

    const jwt = await signTestIdentityToken(keys, {
      sub: "unlinked-user",
      email: "new@school.test",
      iss: issuer,
      aud: audience,
    });
    const response = await app.request("/core/authorization/profiles", {
      headers: { authorization: `Bearer ${jwt}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json() as { profiles: unknown[] }).toEqual({ profiles: [] });
  });

  it("returns 401 without a bearer JWT", async () => {
    const { app } = createProfilesApp();
    const response = await app.request("/core/authorization/profiles");
    expect(response.status).toBe(401);
  });
});
