import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildClientBindings } from "@/lib/school-api/client-bindings";
import { extractClientBindingsFromOpenApi } from "@edaya/client-codegen";

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
    expect(extractClientBindingsFromOpenApi(openApi)).toEqual(buildClientBindings());
  });
});
