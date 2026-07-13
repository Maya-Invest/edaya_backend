import { describe, expect, it } from "bun:test";
import { resolveAuthSecondaryStorage } from "@/runtime/shared/adapters/auth-secondary-storage";

describe("resolveAuthSecondaryStorage", () => {
  it("returns undefined outside the worker runtime", () => {
    expect(resolveAuthSecondaryStorage("local", {
      AUTH_KV: {
        get: async () => null,
        put: async () => {},
        delete: async () => {},
      },
    })).toBeUndefined();
  });

  it("adapts an AUTH_KV binding on worker", async () => {
    const writes: string[] = [];
    const storage = resolveAuthSecondaryStorage("worker", {
      AUTH_KV: {
        get: async () => "session",
        put: async (_key: string, value: string) => {
          writes.push(value);
        },
        delete: async () => {},
      },
    });

    expect(storage).toBeDefined();
    expect(await storage?.get("session:1")).toBe("session");
    await storage?.set("session:1", "next");
    expect(writes).toEqual(["next"]);
  });

  it("returns undefined when the worker binding is absent or invalid", () => {
    expect(resolveAuthSecondaryStorage("worker", {})).toBeUndefined();
    expect(resolveAuthSecondaryStorage("worker", { AUTH_KV: { get: async () => null } })).toBeUndefined();
  });
});
