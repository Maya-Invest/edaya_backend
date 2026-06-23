import { describe, expect, it } from "bun:test";
import { SCHOOL_COMMAND_KEYS } from "@edaya/core";
import { coreCommands } from "@/lib/school-api/registry";
import type { CoreCommandMethodName } from "@/lib/school-api/dispatch/commands";

function keyDifference(actual: readonly string[], expected: readonly string[]) {
  const actualKeys = new Set(actual);
  const expectedKeys = new Set(expected);
  return {
    missing: expected.filter(key => !actualKeys.has(key)),
    extra: actual.filter(key => !expectedKeys.has(key)),
  };
}

describe("core command dispatch registry", () => {
  it("uses SchoolService method names for every registered command", () => {
    const methodNames = coreCommands.map(command => command.methodName);
    const uniqueMethodNames = new Set(methodNames);

    expect(uniqueMethodNames.size).toBe(methodNames.length);
    expect(keyDifference(methodNames, SCHOOL_COMMAND_KEYS)).toEqual({
      missing: [],
      extra: [],
    });
    for (const methodName of methodNames) {
      expect(typeof methodName).toBe("string");
      expect((methodName as CoreCommandMethodName).length).toBeGreaterThan(0);
    }
  });
});
