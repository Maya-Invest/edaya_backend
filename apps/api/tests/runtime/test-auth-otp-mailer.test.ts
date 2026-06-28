import { describe, expect, it, mock } from "bun:test";
import { shouldRequireEmailVerification } from "@/runtime/shared/adapters/auth-email-delivery";
import {
  createAuthEmailSenders,
  getLastAuthOtpForTests,
  getLastAuthVerificationUrlForTests,
  resetAuthOtpMailerForTests,
} from "@/runtime/shared/adapters/auth-otp-mailer";
import { createAppLogger, resetAppLoggersForTests } from "@/runtime/shared/adapters/pino-logger";

describe("createAuthEmailSenders", () => {
  it("stores OTP in test mode for integration tests", async () => {
    resetAuthOtpMailerForTests();
    const { sendAuthVerificationOtp } = createAuthEmailSenders(
      {
        NODE_ENV: "test",
        LOG_LEVEL: "silent",
      } as never,
      createAppLogger({ NODE_ENV: "test", LOG_LEVEL: "silent" } as never),
    );

    await sendAuthVerificationOtp({ email: "Teacher@School.edu", otp: "123456", type: "sign-in" });

    expect(getLastAuthOtpForTests("teacher@school.edu")).toBe("123456");
  });

  it("stores verification URL in test mode", async () => {
    resetAuthOtpMailerForTests();
    const { sendAuthVerificationEmail } = createAuthEmailSenders(
      {
        NODE_ENV: "test",
        LOG_LEVEL: "silent",
      } as never,
      createAppLogger({ NODE_ENV: "test", LOG_LEVEL: "silent" } as never),
    );

    await sendAuthVerificationEmail({
      email: "owner@school.edu",
      url: "https://api.edaya.test/auth/verify?token=abc",
    });

    expect(getLastAuthVerificationUrlForTests("owner@school.edu"))
      .toBe("https://api.edaya.test/auth/verify?token=abc");
  });

  it("delivers OTP through Novu when configured", async () => {
    resetAuthOtpMailerForTests();
    const sendOtp = mock(async () => {});
    const { sendAuthVerificationOtp } = createAuthEmailSenders(
      {
        NODE_ENV: "development",
        LOG_LEVEL: "silent",
        NOVU_SECRET_KEY: "novu-test-key",
      } as never,
      createAppLogger({ NODE_ENV: "development", LOG_LEVEL: "silent" } as never),
      {
        delivery: {
          mode: "novu",
          port: {
            sendOtp,
            sendVerificationEmail: mock(async () => {}),
          },
        },
      },
    );

    await sendAuthVerificationOtp({ email: "teacher@school.edu", otp: "654321", type: "sign-in" });

    expect(sendOtp).toHaveBeenCalledWith({
      email: "teacher@school.edu",
      otp: "654321",
      type: "sign-in",
    });
    expect(getLastAuthOtpForTests("teacher@school.edu")).toBeUndefined();
  });

  it("logs OTP in development without Novu", async () => {
    resetAuthOtpMailerForTests();
    resetAppLoggersForTests();
    const { sendAuthVerificationOtp } = createAuthEmailSenders(
      {
        NODE_ENV: "development",
        LOG_LEVEL: "silent",
      } as never,
      createAppLogger({ NODE_ENV: "development", LOG_LEVEL: "silent" } as never),
    );

    await sendAuthVerificationOtp({ email: "teacher@school.edu", otp: "654321", type: "sign-in" });

    expect(getLastAuthOtpForTests("teacher@school.edu")).toBeUndefined();
  });
});

describe("shouldRequireEmailVerification", () => {
  it("defaults to true when Novu is configured", () => {
    expect(shouldRequireEmailVerification({ NOVU_SECRET_KEY: "key" } as never)).toBe(true);
  });

  it("defaults to false without Novu", () => {
    expect(shouldRequireEmailVerification({} as never)).toBe(false);
  });

  it("honors explicit override", () => {
    expect(shouldRequireEmailVerification({
      NOVU_SECRET_KEY: "key",
      REQUIRE_EMAIL_VERIFICATION: false,
    } as never)).toBe(false);
  });
});
