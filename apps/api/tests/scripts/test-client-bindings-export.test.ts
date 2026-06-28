import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildClientBindings,
  CLIENT_BINDINGS_OPENAPI_EXTENSION,
} from "@/lib/school-api/client-bindings";

const openApiPath = resolve(
  import.meta.dirname,
  "../../../../apps/webapp/src/lib/api/openapi.json",
);

describe("exported OpenAPI client bindings", () => {
  it("embeds the registry bindings under info.x-edaya-client-bindings", () => {
    const openApi = JSON.parse(readFileSync(openApiPath, "utf8")) as {
      info?: Record<string, unknown>;
    };

    expect(openApi.info?.[CLIENT_BINDINGS_OPENAPI_EXTENSION]).toEqual(
      buildClientBindings(),
    );
  });
});
