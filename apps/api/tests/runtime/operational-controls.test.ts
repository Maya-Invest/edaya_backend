import { createApiRuntime } from "../../src/runtime/shared/create-api-runtime";
import { describe, expect, test } from "bun:test";
import worker from "../../src/entries/worker";
import { isPaused, maintenanceResponse } from "../../src/operational-controls";
import { EnvSchema } from "../../src/runtime/shared/env/schema";

const controls = ["PAUSE_API", "PAUSE_SCHEDULER", "PAUSE_JOBS"] as const;

describe("operational controls", () => {
  test("early controls and runtime schema accept identical booleans", () => {
    for (const key of controls) {
      for (const [value, expected] of [[undefined, false], [true, true], [false, false], [1, true], [0, false], ["true", true], ["false", false], ["1", true], ["0", false], [" TRUE ", true]] as const) {
        expect(isPaused({ [key]: value }, key)).toBe(expected);
        expect(EnvSchema.parse({ DATABASE_URL: "pglite:memory", [key]: value })[key]).toBe(expected);
      }
      for (const value of ["yes", "", null, 2, {}]) {
        expect(() => isPaused({ [key]: value }, key)).toThrow(key);
        expect(() => EnvSchema.parse({ DATABASE_URL: "pglite:memory", [key]: value })).toThrow();
      }
    }
  });
  test("returns a neutral uncached retryable response", async () => {
    const response = maintenanceResponse();
    expect(response.status).toBe(503);
    const body = await response.json() as { message: string };
    expect(body).toEqual({ message: "Maintenance in progress" });
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  for (const origin of ["https://staging.api.edayaplus.com", "https://api.edayaplus.com", "https://custom.example"]) {
    for (let mask = 0; mask < 8; mask++) {
      test(`${origin}: pause combination ${mask} gates only its own handler`, async () => {
        const bindings: Record<string, unknown> = { API_ORIGIN: origin };
        controls.forEach((key, bit) => {
          bindings[key] = Boolean(mask & (1 << bit));
        });
        // A running path must reach runtime binding resolution.
        // A paused one must not.
        for (const name of ["HYPERDRIVE", "HYPERDRIVE_AUTH", "EMAIL", "BROWSER"]) {
          Object.defineProperty(bindings, name, { get() {
            throw new Error("runtime reached");
          } });
        }
        const http = worker.fetch(new Request(origin), bindings, {} as never);
        if (mask & 1)
          expect((await http).status).toBe(503);
        else await expect(http).rejects.toThrow("runtime reached");
        const scheduled = worker.scheduled({} as never, bindings, {} as never);
        if (mask & 2)
          await scheduled;
        else await expect(scheduled).rejects.toThrow("runtime reached");
        let retries = 0;
        const queue = worker.queue({ retryAll(options: { delaySeconds: number }) {
          expect(options.delaySeconds).toBe(60);
          retries++;
        }, ackAll() {
          throw new Error("must not acknowledge");
        } } as never, bindings);
        if (mask & 4) {
          await queue;
          expect(retries).toBe(1);
        }
        else {
          await expect(queue).rejects.toThrow("runtime reached");
          expect(retries).toBe(0);
        }
      });
    }
  }
});

test("paused request notification draining never initializes school storage", async () => {
  const env = EnvSchema.parse({ DATABASE_URL: "pglite:memory", PAUSE_JOBS: true });
  const runtime = await createApiRuntime({
    env,
    resolveSchoolHandle: async () => { throw new Error("database must remain unopened"); },
    initSchoolApplication: () => { throw new Error("application must remain unopened"); },
  });
  await runtime.drainNotifications!();
  await runtime.close();
});
