import { MessageDeliveryRecipientKind } from "@edaya/core";
import { expect, test } from "bun:test";
import { createNotifyNotificationGateway } from "../src/notification-gateway";
import { drainPendingSchoolNotifications } from "../src/jobs/drain-jobs";
import { createTestNotifyRuntime } from "./harness";

test("partial device failure retries only that installation; token rotation and logout remain isolated", async () => {
  const calls: string[] = [];
  let failSecond = true;
  const f = await createTestNotifyRuntime({ fcm: { send: async ({ token }) => {
    calls.push(token);
    if (token === "second" && failSecond)
      throw new Error("temporary failure");
    return { providerMessageId: token };
  } } });
  try {
    const recipient = { kind: MessageDeliveryRecipientKind.Guardian, id: "guardian", subjectId: "login" };
    f.runtime.resolveSchoolRecipient = async () => ({ schoolId: "school", recipient, preferences: { channels: { push: true, email: false } } });
    const gateway = createNotifyNotificationGateway({ runtime: f.runtime });
    const device = { appId: "guardian" as const, profileKind: "guardian", profileId: "guardian", schoolId: "school", subjectId: "login", provider: "fcm" as const };
    await gateway.registerPushDevice!({ ...device, installationId: "one", token: "old" });
    await gateway.registerPushDevice!({ ...device, installationId: "one", token: "first" });
    await gateway.registerPushDevice!({ ...device, installationId: "two", token: "second" });
    await gateway.registerPushDevice!({ ...device, appId: "teacher", profileKind: "teacher", profileId: "teacher", installationId: "one", token: "teacher" });
    await gateway.enqueue({ idempotencyKey: "delivery", schoolId: "school", kind: "event", eventKey: "announcement.published", title: "Title", body: "Body", recipients: [recipient] });
    await drainPendingSchoolNotifications(f.runtime);
    expect(calls.sort()).toEqual(["first", "second"]);
    expect(await f.runtime.sql.query("SELECT status FROM notify.jobs")).toEqual([{ status: "failed" }]);
    failSecond = false;
    await f.runtime.sql.execute("UPDATE notify.jobs SET next_attempt_at = NOW() - INTERVAL '1 minute'");
    await drainPendingSchoolNotifications(f.runtime);
    expect(calls.filter(token => token === "first")).toHaveLength(1);
    expect(calls.filter(token => token === "second")).toHaveLength(2);
    expect(await f.runtime.sql.query("SELECT status FROM notify.jobs")).toEqual([{ status: "sent" }]);
    await gateway.unregisterPushDevice!({ ...device, installationId: "one" });
    expect(await f.runtime.sql.query("SELECT token FROM notify.devices ORDER BY token")).toEqual([{ token: "second" }, { token: "teacher" }]);
  }
  finally { await f.close(); }
});
