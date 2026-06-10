import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "bun:test";

describe("createAuth schema guard", () => {
  it("keeps authSchema imported and passed to drizzleAdapter", () => {
    const sourcePath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../src/lib/runtime/create-auth.ts",
    );
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("@edaya/adaptor-betterauth");
    expect(source).toContain("authSchema");
    expect(source).toMatch(/schema:\s*authSchema/);
  });
});
