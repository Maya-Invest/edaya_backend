import { describe, expect, test } from "bun:test";
import { handleGraphiQLLogin, handleGraphiQLLogout } from "@/lib/graphql/graphiql-login";

interface MockHandlerResponse {
  body: unknown;
  status: number;
  headers: Headers;
}

function createContext(options: {
  nodeEnv?: string;
  body?: unknown;
  handler?: (request: Request) => Promise<Response>;
}) {
  const headers = new Headers();
  const responseBody: MockHandlerResponse = {
    body: undefined,
    status: 200,
    headers,
  };

  return {
    env: {
      NODE_ENV: options.nodeEnv ?? "test",
      BETTER_AUTH_URL: "http://localhost:9999",
    },
    req: {
      raw: { headers: new Headers({ cookie: "session=abc" }) },
      json: async () => options.body,
    },
    get(key: string) {
      if (key === "auth") {
        return {
          handler: options.handler ?? (async () => new Response("ok", { status: 200 })),
        };
      }
      return undefined;
    },
    header(name: string, value: string, init?: { append?: boolean }) {
      if (init?.append) {
        headers.append(name, value);
        return;
      }
      headers.set(name, value);
    },
    json(body: unknown, status = 200) {
      responseBody.body = body;
      responseBody.status = status;
      return responseBody;
    },
    newResponse(body: BodyInit | null, init?: ResponseInit) {
      responseBody.body = body;
      responseBody.status = init?.status ?? 200;
      if (init?.headers instanceof Headers) {
        init.headers.forEach((value, key) => headers.set(key, value));
      }
      return responseBody;
    },
  } as never;
}

describe("handleGraphiQLLogin", () => {
  test("returns 404 when GraphiQL login is disabled", async () => {
    const response = await handleGraphiQLLogin(createContext({
      nodeEnv: "production",
      body: { email: "teacher@school.edu", password: "secret" },
    })) as MockHandlerResponse;

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "GraphiQL login is disabled" });
  });

  test("returns 401 when Better Auth rejects credentials", async () => {
    const response = await handleGraphiQLLogin(createContext({
      body: { email: "teacher@school.edu", password: "wrong" },
      handler: async () => new Response("Invalid credentials", { status: 401 }),
    })) as MockHandlerResponse;

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Invalid credentials" });
  });

  test("forwards successful auth cookies to the client", async () => {
    const response = await handleGraphiQLLogin(createContext({
      body: { email: "teacher@school.edu", password: "secret" },
      handler: async () => new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": "session=token; Path=/; HttpOnly",
        },
      }),
    })) as MockHandlerResponse;

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("session=token");
  });
});

describe("handleGraphiQLLogout", () => {
  test("forwards Better Auth sign-out responses", async () => {
    const response = await handleGraphiQLLogout(createContext({
      handler: async () => new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": "session=; Path=/; Max-Age=0",
        },
      }),
    })) as MockHandlerResponse;

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("session=");
  });
});
