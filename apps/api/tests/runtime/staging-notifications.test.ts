import { expect, test } from "bun:test";
import { allowStagingNotification } from "../../src/staging-notifications";

test("staging school deliveries require an explicitly designated recipient", () => {
  const staging = "https://staging.api.school.edayaplus.com";
  expect(allowStagingNotification(staging, "fixture@example.test", "")).toBe(false);
  expect(allowStagingNotification(staging, "unrelated@example.test", "fixture@example.test")).toBe(false);
  expect(allowStagingNotification(staging, "FIXTURE@example.test", " fixture@example.test ")).toBe(true);
  expect(allowStagingNotification(staging, undefined, "fixture@example.test")).toBe(false);
  expect(allowStagingNotification("https://api.school.edayaplus.com", "customer@example.test", "")).toBe(true);
});
