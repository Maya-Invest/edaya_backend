import { describe, expect, it } from "bun:test";
import configureOpenAPI from "@/lib/configure-open-api";
import { createRouter } from "@/lib/create-app";
import indexRouter from "@/routes/index.route";

describe("OpenAPI document", () => {
  it("generates /doc without unsupported Zod schema errors", async () => {
    const app = createRouter();
    configureOpenAPI(app);
    app.route("/", indexRouter);

    const res = await app.request("/doc");

    expect(res.status).toBe(200);
    const doc = await res.json() as {
      openapi: string;
      components: { schemas: { ReportCardResultSection: { type: string } } };
    };
    expect(doc.openapi).toBe("3.0.0");
    expect(doc.components.schemas.ReportCardResultSection.type).toBe("object");
  });
});
