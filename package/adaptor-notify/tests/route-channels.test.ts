import { describe, expect, test } from "bun:test";
import { resolveSendChannels } from "../src/jobs/route-channels";
import type { NotifyRecipientRow } from "../src/store/types";

function recipient(overrides: Partial<NotifyRecipientRow> = {}): NotifyRecipientRow {
  return {
    subject_id: "sub",
    tenant: "sch",
    email: "a@b.c",
    display_name: null,
    locale: null,
    allows_notifications: true,
    channel_email: true,
    channel_push: false,
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

  test("invitation path is email only", () => {
    expect(resolveSendChannels(recipient({ channel_push: true }), { emailOnly: true })).toEqual(["email"]);
  });
});
