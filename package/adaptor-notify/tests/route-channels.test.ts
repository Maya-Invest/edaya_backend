import { describe, expect, test } from "bun:test";
import { resolveSendChannels } from "../src/jobs/route-channels";
import type { NotifyRecipientRow } from "../src/store/types";

function recipient(overrides: Partial<NotifyRecipientRow> = {}): NotifyRecipientRow {
  return {
    subject_id: "sub",
    tenant: "sch",
    email: "a@b.c",
    phone: "+15145550123",
    display_name: null,
    locale: null,
    allows_notifications: true,
    channel_email: true,
    channel_push: false,
    channel_sms: false,
    recipient_kind: "guardian",
    recipient_id: "g1",
    ...overrides,
  };
}

describe("resolveSendChannels", () => {
  test("sends email when allowed", () => {
    expect(resolveSendChannels(recipient())).toEqual(["email"]);
  });

  test("skips when notifications are disabled", () => {
    expect(resolveSendChannels(recipient({ allows_notifications: false }))).toEqual([]);
  });

  test("includes push when enabled", () => {
    expect(resolveSendChannels(recipient({ channel_push: true }))).toEqual(["email", "push"]);
  });

  test("includes SMS when enabled with a phone number", () => {
    expect(resolveSendChannels(recipient({ channel_sms: true }))).toEqual(["email", "sms"]);
  });

  test("invitation email path excludes push and SMS", () => {
    expect(resolveSendChannels(recipient({ channel_push: true, channel_sms: true }), { channels: ["email"] })).toEqual(["email"]);
  });

  test("invitation SMS path is SMS only", () => {
    expect(resolveSendChannels(recipient({ channel_email: false, channel_sms: true }), { channels: ["sms"] })).toEqual(["sms"]);
  });
});
