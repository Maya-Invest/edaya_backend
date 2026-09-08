import { AccountInvitationKind } from "@edaya/core";
import { describe, expect, test } from "bun:test";
import { createNotifyInvitationDeliveryPort } from "../src/invitation-delivery";
import { createNotifyAuthEmailDeliveryPort } from "../src/auth-email-delivery";
import { NotifySendError } from "../src/errors";
import { createTestNotifyRuntime } from "./harness";

describe("in-process invitation and auth delivery", () => {
  test("sends auth OTP to the normalized address", async () => {
    const harness = await createTestNotifyRuntime();
    const port = createNotifyAuthEmailDeliveryPort(harness.runtime);
    await port.sendOtp({ email: "Owner@School.edu", otp: "123456", type: "sign-in" });
    expect(harness.sent[0]?.to).toBe("owner@school.edu");
    expect(harness.sent[0]?.subject).toContain("sign-in");
    await harness.close();
  });

  test("throws when invitation email send fails", async () => {
    const harness = await createTestNotifyRuntime({
      email: {
        async send() {
          throw new Error("smtp down");
        },
      },
    });
    const port = createNotifyInvitationDeliveryPort(harness.runtime);
    await expect(port.deliver({
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
    })).rejects.toBeInstanceOf(NotifySendError);
    await harness.close();
  });
});
