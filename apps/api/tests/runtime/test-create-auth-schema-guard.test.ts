import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "bun:test";

describe("createBetterAuth schema guard", () => {
  it("keeps authSchema imported and passed to drizzleAdapter", () => {
    const sourcePath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../src/runtime/shared/adapters/better-auth.ts",
    );
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toMatch(/@edaya\/adaptor-auth(\/schema)?/);
    expect(source).toContain("authSchema");
    expect(source).toMatch(/schema:\s*authSchema/);
    expect(source).toContain("provider: \"pg\"");
    expect(source).toContain("schemaName: \"auth\"");
  });
});
