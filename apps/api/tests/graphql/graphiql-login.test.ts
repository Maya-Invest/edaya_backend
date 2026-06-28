import { describe, expect, it } from "bun:test";
import { createRouter } from "@/http/create-app";
import { mountGraphQLRoute } from "@/lib/graphql/mount";

describe("GraphiQL login route", () => {
  it("rejects invalid login payloads", async () => {
    const app = createRouter();
    mountGraphQLRoute(app);

    const response = await app.request("/graphiql/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "" }),
    });

    expect(response.status).toBe(400);
  });

  it("exposes login helpers in the GraphiQL page", async () => {
    const app = createRouter();
    mountGraphQLRoute(app);

    const response = await app.request("/graphiql");
    const html = await response.text();

    expect(html).toContain("/graphiql/login");
    expect(html).toContain("graphiql-login-form");
    expect(html).toContain("limit: 50");
    expect(html).toContain("offset: 0");
  });
});
