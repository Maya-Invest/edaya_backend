import { AccountInvitationKind } from "@edaya/core";
import { describe, expect, test } from "bun:test";
import { NotifySendError } from "../src/errors";
import { drainPendingSchoolNotifications } from "../src/jobs/drain-jobs";
import { createNotifyInvitationDeliveryPort } from "../src/invitation-delivery";
import { createTestNotifyRuntime, unimplementedTestSms } from "./harness";

describe("in-process invitation delivery", () => {
  test("rejects phone invitations when SMS transport is unimplemented", async () => {
    const harness = await createTestNotifyRuntime({ sms: unimplementedTestSms });
    try {
      const port = createNotifyInvitationDeliveryPort(harness.runtime);
      await expect(port.deliver({
        invitationId: "inv_phone",
        schoolId: "sch_1",
        contactChannel: "phone",
        contactValue: "+15145550123",
        displayName: "Invitee",
        actorKind: AccountInvitationKind.Staff,
        inviteUrl: "https://app.test/invite/inv_phone",
        expiresAt: new Date(),
        smsBody: "Join EDaya",
      })).rejects.toBeInstanceOf(NotifySendError);
      expect(harness.sentSms).toHaveLength(0);
      expect(await harness.runtime.sql.query("SELECT idempotency_key FROM notify.jobs")).toEqual([]);
    }
    finally { await harness.close(); }
  });

  test("sends invitation SMS through the log transport after drain", async () => {
    const harness = await createTestNotifyRuntime();
    try {
      const port = createNotifyInvitationDeliveryPort(harness.runtime);
      harness.runtime.resolveInvitationRecipient = async request => ({
        ...request,
        contactChannel: "phone",
        contactValue: "+15145550123",
      });
      await port.deliver({
        invitationId: "inv_sms",
        schoolId: "sch_1",
        contactChannel: "phone",
        contactValue: "+15145550123",
        displayName: "Invitee",
        actorKind: AccountInvitationKind.Staff,
        inviteUrl: "https://app.test/invite/inv_sms",
        expiresAt: new Date(),
        smsBody: "Join EDaya",
      });
      expect(harness.sentSms).toHaveLength(0);
      await drainPendingSchoolNotifications(harness.runtime);
      expect(harness.sent).toHaveLength(0);
      expect(harness.sentSms).toEqual([{ to: "+15145550123", body: "Join EDaya" }]);
    }
    finally { await harness.close(); }
  });

  test("commits invitation intent before sending and retries a failed provider outside the caller", async () => {
    let sends = 0;
    let fail = true;
    const harness = await createTestNotifyRuntime({
      email: {
        async send() {
          sends++;
          if (fail)
            throw new Error("smtp down");
          return { providerMessageId: "recovered" };
        },
      },
    });
    const port = createNotifyInvitationDeliveryPort(harness.runtime);
    harness.runtime.resolveInvitationRecipient = async request => ({
      ...request,
      contactChannel: "email",
      contactValue: "invitee@school.edu",
    });
    await port.deliver({
      invitationId: "inv_fail",
      schoolId: "sch_1",
      contactChannel: "email",
      contactValue: "invitee@school.edu",
      displayName: "Invitee",
      actorKind: AccountInvitationKind.Staff,
      inviteUrl: "https://app.test/invite/inv_fail",
      expiresAt: new Date(),
      emailSubject: "Invite",
      emailBody: "<p>Join</p>",
    });
    expect(sends).toBe(0);
    await drainPendingSchoolNotifications(harness.runtime);
    expect(sends).toBe(1);
    expect(await harness.runtime.sql.query("SELECT status FROM notify.jobs WHERE delivery_id = 'inv_fail'")).toEqual([{ status: "failed" }]);
    fail = false;
    await harness.runtime.sql.execute("UPDATE notify.jobs SET next_attempt_at = NULL WHERE delivery_id = 'inv_fail'");
    await drainPendingSchoolNotifications(harness.runtime);
    await drainPendingSchoolNotifications(harness.runtime);
    expect(sends).toBe(2);
    expect(await harness.runtime.sql.query("SELECT status FROM notify.jobs WHERE delivery_id = 'inv_fail'")).toEqual([{ status: "sent" }]);
    await harness.close();
  });
});

test("invitation destinations and revocation remain in their school namespace", async () => {
  const harness = await createTestNotifyRuntime();
  try {
    const port = createNotifyInvitationDeliveryPort(harness.runtime);
    for (const schoolId of ["a", "b"]) {
      await port.deliver({
        invitationId: "same-invitation",
        schoolId,
        contactChannel: "email",
        contactValue: `${schoolId}@example.test`,
        displayName: "Invitee",
        actorKind: AccountInvitationKind.Guardian,
        inviteUrl: "https://example.test/invite",
        expiresAt: new Date(),
        emailSubject: "Invite",
        emailBody: "Join",
      });
    }
    expect(harness.sent).toHaveLength(0);
    harness.runtime.resolveInvitationRecipient = async request => ({
      ...request,
      contactChannel: "email",
      contactValue: `${request.schoolId}@example.test`,
    });
    await port.revoke("same-invitation", "a");
    expect(await harness.runtime.sql.query("SELECT tenant, email FROM notify.recipients")).toEqual([{ tenant: "b", email: "b@example.test" }]);
    await drainPendingSchoolNotifications(harness.runtime);
    expect(harness.sent.map(message => message.to)).toEqual(["b@example.test"]);
  }
  finally { await harness.close(); }
});

test("queued invitation dispatch fails closed without matching authoritative school, credential and contact", async () => {
  const harness = await createTestNotifyRuntime();
  try {
    const port = createNotifyInvitationDeliveryPort(harness.runtime);
    for (const mode of ["missing", "school", "invitation", "email"] as const) {
      await port.deliver({ invitationId: mode, schoolId: "school", contactChannel: "email", contactValue: "invited@example.test", displayName: "Fixture", actorKind: AccountInvitationKind.Guardian, inviteUrl: "https://example.test/invite", expiresAt: new Date(Date.now() + 60000), emailSubject: "Invite", emailBody: "Synthetic" });
      harness.runtime.resolveInvitationRecipient = mode === "missing"
        ? undefined
        : async request => ({
          schoolId: mode === "school" ? "foreign" : request.schoolId,
          invitationId: mode === "invitation" ? "foreign" : request.invitationId,
          contactChannel: "email",
          contactValue: mode === "email" ? "other@example.test" : "invited@example.test",
        });
      await drainPendingSchoolNotifications(harness.runtime);
      expect(await harness.runtime.sql.query("SELECT status FROM notify.jobs WHERE delivery_id = $1", [mode])).toEqual([{ status: mode === "missing" ? "failed" : "cancelled" }]);
    }
    expect(harness.sent).toHaveLength(0);
  }
  finally { await harness.close(); }
});
