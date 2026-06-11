import { describe, expect, it } from "bun:test";
import { coreCommands } from "@/lib/school-api/registry";
import type { CoreCommandMethodName } from "@/lib/school-api/dispatch/commands";

describe("core command dispatch registry", () => {
  it("uses SchoolService method names for every registered command", () => {
    const methodNames = coreCommands.map(command => command.methodName);
    const uniqueMethodNames = new Set(methodNames);

    expect(uniqueMethodNames.size).toBe(methodNames.length);
    for (const methodName of methodNames) {
      expect(typeof methodName).toBe("string");
      expect((methodName as CoreCommandMethodName).length).toBeGreaterThan(0);
    }
  });
});
