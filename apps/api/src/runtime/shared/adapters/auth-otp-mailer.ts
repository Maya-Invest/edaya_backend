import type { LoggerPort } from "@edaya/core";
import type { Environment } from "@/runtime/shared/env/schema";

export type AuthOtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

export interface AuthOtpDeliveryInput {
  email: string;
  otp: string;
  type: AuthOtpType;
}

const testOtpByEmail = new Map<string, string>();

export function resetAuthOtpMailerForTests(): void {
  testOtpByEmail.clear();
}

export function getLastAuthOtpForTests(email: string): string | undefined {
  return testOtpByEmail.get(email.trim().toLowerCase());
}

export function createAuthOtpMailer(env: Environment, logger: LoggerPort) {
  return async function sendAuthVerificationOtp(input: AuthOtpDeliveryInput): Promise<void> {
    const normalizedEmail = input.email.trim().toLowerCase();

    if (env.NODE_ENV === "test") {
      testOtpByEmail.set(normalizedEmail, input.otp);
      return;
    }

    if (env.NODE_ENV !== "production") {
      logger.info(
        { email: normalizedEmail, otp: input.otp, type: input.type },
        "Auth OTP (dev only — configure production email delivery before launch)",
      );
      return;
    }

    logger.warn(
      { email: normalizedEmail, type: input.type },
      "Auth OTP email delivery is not configured for production",
    );
  };
}
