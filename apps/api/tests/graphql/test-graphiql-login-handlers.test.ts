import { describe, expect, test } from "bun:test";
import { handleGraphiQLLogin, handleGraphiQLLogout } from "@/lib/graphql/graphiql-login";

function createContext(nodeEnv: string, body?: unknown) {
  return {
    env: { NODE_ENV: nodeEnv, IDENTITY_ISSUER: "http://localhost:9900", API_ORIGIN: "http://localhost:9999" },
    req: { json: async () => body },
    json: (value: unknown, status = 200) => ({ value, status }),
    body: (_value: unknown, status = 200) => ({ status }),
  } as never;
}

describe("GraphiQL identity handlers", () => {
  test("disables login in production", async () => {
    const response = await handleGraphiQLLogin(createContext("production", {
      email: "teacher@school.edu",
      password: "secret",
    })) as { status: number };
    expect(response.status).toBe(404);
  });

  test("rejects malformed credentials before contacting identity", async () => {
    const response = await handleGraphiQLLogin(createContext("test", {
      email: "invalid",
      password: "",
    })) as { status: number };
    expect(response.status).toBe(400);
  });

  test("school logout does not manage identity cookies", async () => {
    const response = await handleGraphiQLLogout(createContext("test")) as { status: number };
    expect(response.status).toBe(204);
  });
});
