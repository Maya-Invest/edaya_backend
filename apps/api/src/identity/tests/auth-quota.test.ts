import { describe, expect, test } from "bun:test";
import { authRequestQuota } from "../env";

describe("authRequestQuota", () => {
  test("keeps worker quotas tight", () => {
    expect(authRequestQuota("worker", 120)).toBe(120);
    expect(authRequestQuota("worker", 30)).toBe(30);
  });
  test("raises local and test quotas for integration bursts", () => {
    expect(authRequestQuota("local", 120)).toBe(10000);
    expect(authRequestQuota("test", 30)).toBe(10000);
  });
});
