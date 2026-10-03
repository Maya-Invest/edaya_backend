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
      paths: Record<string, { get?: { security: unknown }; post?: { security: unknown } }>;
      components: { schemas: { ReportCardResultSection: { type: string } } };
    };
    expect(doc.openapi).toBe("3.0.0");
    expect(doc.components.schemas.ReportCardResultSection.type).toBe("object");
    expect(doc.paths["/auth/edaya/otp/start"].post?.security).toEqual([]);
    expect(doc.paths["/auth/edaya/access-token"].post).toBeDefined();
    expect(Object.keys(doc.paths).some(path => path.startsWith("/internal/"))).toBe(false);
  });
});
