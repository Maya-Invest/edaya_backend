import { expect, test } from "bun:test";
import { allowStagingInvitation, allowStagingNotification } from "../../src/staging-notifications";

test("staging school deliveries require an explicitly designated recipient", () => {
  const staging = "https://staging.school.api.edayaplus.com";
  expect(allowStagingNotification(staging, "fixture@example.test", "")).toBe(false);
  expect(allowStagingNotification(staging, "unrelated@example.test", "fixture@example.test")).toBe(false);
  expect(allowStagingNotification(staging, "FIXTURE@example.test", " fixture@example.test ")).toBe(true);
  expect(allowStagingNotification(staging, undefined, "fixture@example.test")).toBe(false);
  expect(allowStagingNotification("https://school.api.edayaplus.com", "customer@example.test", "")).toBe(true);
});

test("staging invitation allowlist does not cancel phone rows", () => {
  const staging = "https://staging.school.api.edayaplus.com";
  expect(allowStagingInvitation(staging, undefined, "fixture@example.test")).toBe(false);
  expect(allowStagingInvitation(staging, { contactChannel: "email", contactValue: "unrelated@example.test" }, "fixture@example.test")).toBe(false);
  expect(allowStagingInvitation(staging, { contactChannel: "email", contactValue: "fixture@example.test" }, "fixture@example.test")).toBe(true);
  expect(allowStagingInvitation(staging, { contactChannel: "phone", contactValue: "+15145550123" }, "fixture@example.test")).toBe(true);
});
