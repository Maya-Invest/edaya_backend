import type { LoggerPort } from "@edaya/core";
import type { Environment } from "@/runtime/shared/env/schema";
import {
  resolveAuthEmailDelivery,
  type ResolvedAuthEmailDelivery,
} from "@/runtime/shared/adapters/auth-email-delivery";

export type AuthOtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

export interface AuthOtpDeliveryInput {
  email: string;
  otp: string;
  type: AuthOtpType;
}

export interface AuthVerificationEmailInput {
  email: string;
  url: string;
  displayName?: string;
}

const testOtpByEmail = new Map<string, string>();
const testVerificationUrlsByEmail = new Map<string, string>();

export function resetAuthOtpMailerForTests(): void {
  testOtpByEmail.clear();
  testVerificationUrlsByEmail.clear();
}

export function getLastAuthOtpForTests(email: string): string | undefined {
  return testOtpByEmail.get(email.trim().toLowerCase());
}

export function getLastAuthVerificationUrlForTests(email: string): string | undefined {
  return testVerificationUrlsByEmail.get(email.trim().toLowerCase());
}

function shouldLogAuthEmailInDev(env: Environment): boolean {
  if (env.AUTH_EMAIL_LOG_OTP === false) {
    return false;
  }
  return env.NODE_ENV === "development";
}

export interface CreateAuthEmailSendersOptions {
  delivery?: ResolvedAuthEmailDelivery;
}

export function createAuthEmailSenders(
  env: Environment,
  logger: LoggerPort,
  options: CreateAuthEmailSendersOptions = {},
) {
  const delivery = options.delivery ?? resolveAuthEmailDelivery(env);

  async function sendAuthVerificationOtp(input: AuthOtpDeliveryInput): Promise<void> {
    const normalizedEmail = input.email.trim().toLowerCase();

    if (env.NODE_ENV === "test") {
      testOtpByEmail.set(normalizedEmail, input.otp);
      return;
    }

    if (delivery.mode === "novu" && delivery.port) {
      await delivery.port.sendOtp({
        email: normalizedEmail,
        otp: input.otp,
        type: input.type,
      });
    }

    if (delivery.mode === "novu" && shouldLogAuthEmailInDev(env)) {
      logger.info(
        { email: normalizedEmail, otp: input.otp, type: input.type, delivery: delivery.mode },
        "Auth OTP sent via Novu (dev log copy)",
      );
    }
    else if (delivery.mode === "log") {
      if (env.NODE_ENV === "production") {
        logger.warn(
          { email: normalizedEmail, type: input.type },
          "Auth OTP email delivery is not configured for production",
        );
      }
      else {
        logger.info(
          { email: normalizedEmail, otp: input.otp, type: input.type, delivery: delivery.mode },
          "Auth OTP (configure NOVU_SECRET_KEY for real email delivery)",
        );
      }
    }
  }

  async function sendAuthVerificationEmail(input: AuthVerificationEmailInput): Promise<void> {
    const normalizedEmail = input.email.trim().toLowerCase();

    if (env.NODE_ENV === "test") {
      testVerificationUrlsByEmail.set(normalizedEmail, input.url);
      return;
    }

    if (delivery.mode === "novu" && delivery.port) {
      await delivery.port.sendVerificationEmail({
        email: normalizedEmail,
        url: input.url,
        displayName: input.displayName,
      });
    }

    if (delivery.mode === "novu" && shouldLogAuthEmailInDev(env)) {
      logger.info(
        { email: normalizedEmail, url: input.url, delivery: delivery.mode },
        "Auth verification email sent via Novu (dev log copy)",
      );
    }
    else if (delivery.mode === "log") {
      if (env.NODE_ENV === "production") {
        logger.warn(
          { email: normalizedEmail },
          "Auth verification email delivery is not configured for production",
        );
      }
      else {
        logger.info(
          { email: normalizedEmail, url: input.url, delivery: delivery.mode },
          "Auth verification email (configure NOVU_SECRET_KEY for real email delivery)",
        );
      }
    }
  }

  return {
    sendAuthVerificationOtp,
    sendAuthVerificationEmail,
    delivery,
  };
}

/** @deprecated Use createAuthEmailSenders().sendAuthVerificationOtp */
export function createAuthOtpMailer(
  env: Environment,
  logger: LoggerPort,
  options: CreateAuthEmailSendersOptions = {},
) {
  return createAuthEmailSenders(env, logger, options).sendAuthVerificationOtp;
}
