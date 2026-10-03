import { handleGraphiQLSession } from "@/lib/graphql/graphiql-session";
import { verifyIdentityToken } from "../../src/identity/server/index";
import { createTestIdentityKeys, signTestIdentityToken } from "../../src/identity/server/testing";
import { describe, expect, test } from "bun:test";
import { createTestStaffActor } from "../support/staff-actor-fixture";

const issuer = "http://localhost:9999";
const audience = "http://localhost:9999";
const keys = await createTestIdentityKeys();
const directory = { lookupByContact: async () => undefined, resolveBySubjectId: async () => undefined };

function createContext(options: {
  nodeEnv?: string;
  token?: string;
  actor?: ReturnType<typeof createTestStaffActor> | null;
}) {
  let body: unknown;
  return {
    env: { NODE_ENV: options.nodeEnv ?? "test" },
    req: { raw: { headers: new Headers(options.token ? { authorization: `Bearer ${options.token}` } : {}) } },
    get(key: string) {
      if (key === "identityClient") {
        return {
          directory,
          verifyAccessToken: (token: string) => verifyIdentityToken(token, { issuer, audience, jwks: keys.jwks }),
        };
      }
      if (key === "actor")
        return options.actor ?? null;
    },
    json(value: unknown, status = 200) {
      body = value;
      return { body, status };
    },
  } as never;
}

describe("handleGraphiQLSession", () => {
  test("returns 404 when GraphiQL is disabled", async () => {
    const response = await handleGraphiQLSession(createContext({ nodeEnv: "production" })) as any;
    expect(response.status).toBe(404);
  });

  test("returns JWT session and actor metadata", async () => {
    const token = await signTestIdentityToken(keys, {
      sub: "user-1",
      email: "teacher@school.edu",
      iss: issuer,
      aud: audience,
    });
    const response = await handleGraphiQLSession(createContext({
      token,
      actor: createTestStaffActor(),
    })) as any;
    expect(response.body).toEqual({
      session: { userId: "user-1", email: "teacher@school.edu", name: null },
      actor: { kind: "staff", actorId: "staff-1", schoolId: "school-1" },
    });
  });

  test("does not authenticate without Authorization", async () => {
    const response = await handleGraphiQLSession(createContext({ actor: null })) as any;
    expect(response.body).toEqual({ session: null, actor: null });
  });
});
