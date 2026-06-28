import { AccountInvitationKind } from "@edaya/core";
import { createNovuInvitationDeliveryPort } from "@edaya/adaptor-novu";
import { describe, expect, mock, test } from "bun:test";

describe("createNovuInvitationDeliveryPort", () => {
  test("delivers via transient subscriber and revokes on delete", async () => {
    const upsert = mock(async () => {});
    const remove = mock(async () => {});
    const trigger = mock(async () => {});

    const port = createNovuInvitationDeliveryPort({
      subscriberClient: {
        upsert,
        remove,
        registerPushDevice: mock(async () => {}),
        unregisterPushDevice: mock(async () => {}),
      },
      triggerClient: {
        trigger,
        triggerBulk: mock(async () => {}),
        cancel: mock(async () => {}),
      },
    });

    await port.deliver({
      invitationId: "inv-1",
      schoolId: "sch1",
      contactChannel: "email",
      contactValue: "user@school.edu",
      displayName: "Paul Martin",
      actorKind: AccountInvitationKind.Staff,
      inviteUrl: "https://app.edaya.test/invite/token",
      expiresAt: new Date("2026-07-01T00:00:00Z"),
      emailSubject: "You're invited to Edaya",
      emailBody: "<p>Join your school on Edaya.</p>",
    });

    expect(upsert).toHaveBeenCalledWith(
      "invite:inv-1",
      "sch1",
      expect.objectContaining({
        email: "user@school.edu",
        displayName: "Paul Martin",
      }),
      { skipWorkflowPreferences: true },
    );
    expect(trigger).toHaveBeenCalledWith(expect.objectContaining({
      to: "invite:inv-1",
      transactionId: "inv-1",
    }));

    await port.revoke("inv-1");
    expect(remove).toHaveBeenCalledWith("invite:inv-1");
  });
});
