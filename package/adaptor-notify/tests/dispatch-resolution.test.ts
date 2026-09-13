import { MessageDeliveryRecipientKind } from "@edaya/core";
import { expect, test } from "bun:test";
import { drainPendingSchoolNotifications } from "../src/jobs/drain-jobs";
import { createNotifyNotificationGateway } from "../src/notification-gateway";
import { createTestNotifyRuntime } from "./harness";

const recipient = { kind: MessageDeliveryRecipientKind.Guardian, id: "guardian", subjectId: "subject" };
const profile = { schoolId: "school", recipient, email: "current@example.test", preferences: { channels: { email: true } } };
const input = { idempotencyKey: "delivery", schoolId: "school", kind: "event" as const, eventKey: "announcement.published", title: "News", body: "Private", recipients: [recipient] };

test("revocation cancels terminally and reports cancellation without retrying", async () => {
  const harness = await createTestNotifyRuntime();
  try {
    const events: string[] = [];
    let resolutions = 0;
    harness.runtime.resolveSchoolRecipient = async () => {
      resolutions++;
      return undefined;
    };
    harness.runtime.onDeliveryEvent = async (event) => {
      events.push(event.status);
    };
    await createNotifyNotificationGateway({ runtime: harness.runtime }).enqueue(input);
    await drainPendingSchoolNotifications(harness.runtime);
    const attempts = resolutions;
    await drainPendingSchoolNotifications(harness.runtime);
    expect(resolutions).toBe(attempts);
    expect(harness.sent).toHaveLength(0);
    expect(events).toEqual(["cancelled"]);
    expect(await harness.runtime.sql.query("SELECT status FROM notify.jobs")).toEqual([{ status: "cancelled" }]);
  }
  finally { await harness.close(); }
});

test.each(["missing", "unavailable"])("%s resolver fails closed and recovers without stale contacts", async (mode) => {
  const harness = await createTestNotifyRuntime();
  try {
    if (mode === "unavailable")
      harness.runtime.resolveSchoolRecipient = async () => { throw new Error("School database unavailable"); };
    await createNotifyNotificationGateway({ runtime: harness.runtime }).enqueue(input);
    await drainPendingSchoolNotifications(harness.runtime);
    expect(harness.sent).toHaveLength(0);
    expect(await harness.runtime.sql.query("SELECT status, lease_id FROM notify.jobs")).toEqual([{ status: "failed", lease_id: null }]);
    harness.runtime.resolveSchoolRecipient = async () => profile;
    await harness.runtime.sql.execute("UPDATE notify.jobs SET next_attempt_at = NULL");
    await drainPendingSchoolNotifications(harness.runtime);
    expect(harness.sent).toEqual([{ to: "current@example.test", subject: "News" }]);
    expect(await harness.runtime.sql.query("SELECT status FROM notify.jobs")).toEqual([{ status: "sent" }]);
  }
  finally { await harness.close(); }
});

test.each(["school", "subject", "metadata"])("mismatched %s cannot dispatch", async (mismatch) => {
  const harness = await createTestNotifyRuntime();
  try {
    harness.runtime.resolveSchoolRecipient = async () => ({ ...profile, schoolId: mismatch === "school" ? "foreign" : profile.schoolId, recipient: { ...recipient, subjectId: mismatch === "subject" ? "unrelated" : recipient.subjectId } });
    await createNotifyNotificationGateway({ runtime: harness.runtime }).enqueue(input);
    if (mismatch === "metadata")
      await harness.runtime.sql.execute("UPDATE notify.jobs SET metadata = '[1]'");
    await drainPendingSchoolNotifications(harness.runtime);
    expect(harness.sent).toHaveLength(0);
    expect(await harness.runtime.sql.query("SELECT status FROM notify.jobs")).toEqual([{ status: "cancelled" }]);
  }
  finally { await harness.close(); }
});
