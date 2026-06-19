import { describe, expect, it } from "bun:test";
import { createRouter } from "@/http/create-app";
import { isGraphiQLEnabled } from "@/lib/graphql/graphiql";
import { mountGraphQLRoute } from "@/lib/graphql/mount";

describe("GraphiQL", () => {
  it("is enabled outside production by default", () => {
    expect(isGraphiQLEnabled("development")).toBe(true);
    expect(isGraphiQLEnabled("test")).toBe(true);
    expect(isGraphiQLEnabled("production")).toBe(false);
  });

  it("serves the interactive playground at /graphiql when enabled", async () => {
    if (!isGraphiQLEnabled()) {
      return;
    }

    const app = createRouter();
    mountGraphQLRoute(app);

    const response = await app.request("/graphiql");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Edaya GraphiQL");
    expect(html).toContain("/graphql");
    expect(html).toContain("credentials: 'include'");
    expect(html).toContain("auth-banner");
    expect(html).toContain("/graphiql/session");
  });
});
