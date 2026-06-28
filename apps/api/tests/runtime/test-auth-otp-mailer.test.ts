import { describe, expect, it } from "bun:test";
import {
  createAuthOtpMailer,
  getLastAuthOtpForTests,
  resetAuthOtpMailerForTests,
} from "@/runtime/shared/adapters/auth-otp-mailer";
import { createAppLogger, resetAppLoggersForTests } from "@/runtime/shared/adapters/pino-logger";

describe("createAuthOtpMailer", () => {
  it("stores OTP in test mode for integration tests", async () => {
    resetAuthOtpMailerForTests();
    const send = createAuthOtpMailer(
      {
        NODE_ENV: "test",
        LOG_LEVEL: "silent",
      } as never,
      createAppLogger({ NODE_ENV: "test", LOG_LEVEL: "silent" } as never),
    );

    await send({ email: "Teacher@School.edu", otp: "123456", type: "sign-in" });

    expect(getLastAuthOtpForTests("teacher@school.edu")).toBe("123456");
  });

  it("logs OTP in development without storing it", async () => {
    resetAuthOtpMailerForTests();
    resetAppLoggersForTests();
    const send = createAuthOtpMailer(
      {
        NODE_ENV: "development",
        LOG_LEVEL: "silent",
      } as never,
      createAppLogger({ NODE_ENV: "development", LOG_LEVEL: "silent" } as never),
    );

    await send({ email: "teacher@school.edu", otp: "654321", type: "sign-in" });

    expect(getLastAuthOtpForTests("teacher@school.edu")).toBeUndefined();
  });
});
