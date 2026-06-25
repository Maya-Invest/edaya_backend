import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "bun:test";

describe("createAuth schema guard", () => {
  it("keeps authSchema imported and passed to drizzleAdapter", () => {
    const sourcePath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../src/runtime/shared/build-better-auth-config.ts",
    );
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toMatch(/@edaya\/betterauth-d1-migrations(\/schema)?/);
    expect(source).toContain("authSchema");
    expect(source).toMatch(/schema:\s*authSchema/);
  });
});
