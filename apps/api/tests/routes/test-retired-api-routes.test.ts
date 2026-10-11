import { afterAll, describe, expect, it } from "bun:test";
import app from "@/app";
import { parseEnv } from "@/runtime";
import { resetApiRuntimesForTests } from "@/runtime/local/registry";

const env = parseEnv({
  RUNTIME: "in-memory",
  NODE_ENV: "test",
  DATABASE_URL: "pglite",
  AUTH_DATABASE_URL: "pglite:memory",
  LOG_LEVEL: "silent",
  // Old deployment variables cannot restore a removed contract.
  ENABLE_GRAPHQL: true,
  GRAPHQL_GRAPHIQL: true,
});

afterAll(resetApiRuntimesForTests);

describe("retired API routes in the shared local and Worker application", () => {
  for (const path of ["/graphql", "/graphiql", "/graphiql/session", "/graphiql/login"]) {
    for (const method of ["GET", "POST"]) {
      it(`${method} ${path} returns not found`, async () => {
        const response = await app.fetch(new Request(`http://localhost:9999${path}`, {
          method,
          headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
          body: method === "POST" ? JSON.stringify({ query: "{ __schema { queryType { name } } }" }) : undefined,
        }), env);

        expect(response.status).toBe(404);
        expect(response.headers.get("content-type")).toContain("application/json");
        expect(response.headers.get("set-cookie")).toBeNull();
        expect(response.headers.get("location")).toBeNull();
        const body = await response.json() as { message: string };
        expect(body).toEqual({ message: `Not Found - ${path}` });
      });
    }
  }

  it("keeps the OpenAPI reference and REST authentication boundary", async () => {
    const request = (path: string, init?: RequestInit) => app.fetch(new Request(`http://localhost:9999${path}`, init), env);
    const doc = await request("/doc");
    expect(doc.status).toBe(200);
    const schema = await doc.json() as { paths: Record<string, unknown> };
    expect(schema.paths["/core/entities/students/list"]).toBeDefined();
    expect(schema.paths["/auth/edaya/access-token"]).toBeDefined();
    expect(Object.keys(schema.paths).some(path => /graphql|graphiql/i.test(path))).toBe(false);
    expect((await request("/reference")).status).toBe(200);
    expect((await request("/core/entities/students/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })).status).toBe(401);
  });
});
