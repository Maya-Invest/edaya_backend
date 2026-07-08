import { createNovuAuthEmailDeliveryPort } from "@edaya/adaptor-novu";
import { AUTH_EMAIL_VERIFICATION_EVENT_KEY, AUTH_OTP_EVENT_KEY } from "@edaya/school-service";
import { describe, expect, mock, test } from "bun:test";

describe("createNovuAuthEmailDeliveryPort", () => {
  test("sends OTP via transient auth subscriber", async () => {
    const upsert = mock(async () => {});
    const trigger = mock(async () => {});

    const port = createNovuAuthEmailDeliveryPort({
      subscriberClient: {
        upsert,
        remove: mock(async () => {}),
        registerPushDevice: mock(async () => {}),
        unregisterPushDevice: mock(async () => {}),
      },
      triggerClient: {
        trigger,
        triggerBulk: mock(async () => {}),
        cancel: mock(async () => {}),
      },
    });

    await port.sendOtp({
      email: "Owner@School.edu",
      otp: "123456",
      type: "sign-in",
    });

    expect(upsert).toHaveBeenCalledWith(
      "auth:owner@school.edu",
      "platform",
      expect.objectContaining({
        email: "owner@school.edu",
      }),
      { skipWorkflowPreferences: true },
    );
    expect(trigger).toHaveBeenCalledWith(expect.objectContaining({
      workflowId: AUTH_OTP_EVENT_KEY,
      to: "auth:owner@school.edu",
      payload: expect.objectContaining({
        emailSubject: "Your EDAYA sign-in code",
      }),
    }));
  });

  test("sends verification link email", async () => {
    const upsert = mock(async () => {});
    const trigger = mock(async () => {});

    const port = createNovuAuthEmailDeliveryPort({
      subscriberClient: {
        upsert,
        remove: mock(async () => {}),
        registerPushDevice: mock(async () => {}),
        unregisterPushDevice: mock(async () => {}),
      },
      triggerClient: {
        trigger,
        triggerBulk: mock(async () => {}),
        cancel: mock(async () => {}),
      },
    });

    await port.sendVerificationEmail({
      email: "owner@school.edu",
      url: "https://api.edaya.test/auth/verify?token=abc",
      displayName: "Ada Owner",
    });

    expect(trigger).toHaveBeenCalledWith(expect.objectContaining({
      workflowId: AUTH_EMAIL_VERIFICATION_EVENT_KEY,
      to: "auth:owner@school.edu",
      payload: expect.objectContaining({
        emailSubject: "Verify your EDAYA email address",
      }),
    }));
  });
});
