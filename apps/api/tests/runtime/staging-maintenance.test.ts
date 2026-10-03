import worker from "../../src/entries/worker";
import { describe, expect, test } from "bun:test";
import { maintenanceResponse, stagingSwitch } from "../../src/staging-maintenance";

describe("staging maintenance", () => {
  test("defaults off without needing runtime configuration", () => {
    expect(stagingSwitch({}, "STAGING_MAINTENANCE")).toBe(false);
    expect(stagingSwitch({ STAGING_MAINTENANCE: "false" }, "STAGING_MAINTENANCE")).toBe(false);
  });
  test("only activates for the exact staging origin", () => {
    expect(stagingSwitch({ API_ORIGIN: "https://staging.api.edayaplus.com", STAGING_MAINTENANCE: "true" }, "STAGING_MAINTENANCE")).toBe(true);
    expect(() => stagingSwitch({ STAGING_MAINTENANCE: "true" }, "STAGING_MAINTENANCE")).toThrow();
    expect(() => stagingSwitch({ API_ORIGIN: "https://production.example", STAGING_PAUSE_JOBS: "true" }, "STAGING_PAUSE_JOBS")).toThrow();
    expect(() => stagingSwitch({ API_ORIGIN: "https://staging.api.edayaplus.com", STAGING_MAINTENANCE: "yes" }, "STAGING_MAINTENANCE")).toThrow();
  });
  test("returns an uncached retryable response", () => {
    const response = maintenanceResponse();
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

test("Worker maintenance skips database initialization and retries queue work", async () => {
  const bindings = { API_ORIGIN: "https://staging.api.edayaplus.com", STAGING_MAINTENANCE: "true" };
  Object.defineProperty(bindings, "HYPERDRIVE", {
    get: () => {
      throw new Error("Database binding must not be read");
    },
  });
  expect((await worker.fetch(new Request("https://staging.api.edayaplus.com/"), bindings, {} as never)).status).toBe(503);
  await worker.scheduled({} as never, bindings, {} as never);
  let retries = 0;
  await worker.queue({
    retryAll: (options: { delaySeconds: number }) => {
      expect(options.delaySeconds).toBe(60);
      retries++;
    },
  } as never, bindings);
  expect(retries).toBe(1);
});
