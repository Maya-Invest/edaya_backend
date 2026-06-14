import { describe, expect, it } from "bun:test";
import configureOpenAPI from "@/http/openapi";
import { createRouter } from "@/http/create-app";
import indexRouter from "@/app-router";

describe("OpenAPI document", () => {
  it("generates /doc without unsupported Zod schema errors", async () => {
    const app = createRouter();
    configureOpenAPI(app);
    app.route("/", indexRouter);

    const res = await app.request("/doc");

    expect(res.status).toBe(200);
    const doc = await res.json() as {
      openapi: string;
      paths: Record<string, unknown>;
      components: { schemas: { ReportCardResultSection: { type: string } } };
    };
    expect(doc.openapi).toBe("3.0.0");
    expect(doc.components.schemas.ReportCardResultSection.type).toBe("object");
    expect(Object.keys(doc.paths).some(path => path.startsWith("/auth"))).toBe(false);
  });
});
