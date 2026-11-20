import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildClientBindings } from "@/lib/school-api/client-bindings";
import { extractClientBindingsFromOpenApi } from "../../../../tooling/repo/codegen/src/index";

const openApiPath = resolve(
  import.meta.dirname,
  "../../../../tooling/repo/fixtures/openapi.json",
);

describe("exported OpenAPI client bindings", () => {
  it("encodes registry bindings on core operation extensions", () => {
    const openApi = JSON.parse(readFileSync(openApiPath, "utf8")) as {
      paths?: Record<string, Record<string, Record<string, unknown>>>;
      info?: Record<string, unknown>;
    };

    expect(openApi.info?.["x-edaya-client-bindings"]).toBeUndefined();
    const { auth, ...school } = extractClientBindingsFromOpenApi(openApi);
    expect(school).toEqual(buildClientBindings());
    expect(auth).toMatchObject({ accessToken: { path: "/auth/edaya/access-token", basePath: "root", requestSchemaName: "AuthResource", responseSchemaName: "AuthAccessToken" } });
  });
});
