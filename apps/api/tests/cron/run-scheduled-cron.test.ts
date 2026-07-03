import { describe, expect, test } from "bun:test";
import { parseCronJobKeysFilter } from "@/cron/run-scheduled-cron";

describe("parseCronJobKeysFilter", () => {
  test("returns undefined when unset or empty", () => {
    expect(parseCronJobKeysFilter(undefined)).toBeUndefined();
    expect(parseCronJobKeysFilter("")).toBeUndefined();
    expect(parseCronJobKeysFilter(" , ")).toBeUndefined();
  });

  test("parses comma-separated job keys", () => {
    expect(parseCronJobKeysFilter("processDueNotifications")).toEqual(["processDueNotifications"]);
    expect(parseCronJobKeysFilter("processDueNotifications, reconcilePendingDeliveries")).toEqual([
      "processDueNotifications",
      "reconcilePendingDeliveries",
    ]);
  });
});
