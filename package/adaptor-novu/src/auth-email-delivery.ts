import { MessageDeliveryRecipientKind } from "@edaya/core";
import { AUTH_EMAIL_VERIFICATION_EVENT_KEY, AUTH_OTP_EVENT_KEY, AUTH_PLATFORM_CONTEXT_ID } from "@edaya/service";
import type { NovuSubscriberClient } from "./novu-subscriber-client";
import { createNovuSdkClient } from "./novu-sdk-client";
import { createNovuSubscriberClient } from "./novu-subscriber-client";
import { buildNovuTriggerSubscriber } from "./trigger-recipient";
import type { NovuTriggerClient } from "./types";

export type AuthOtpEmailType
  = | "sign-in"
    | "email-verification"
    | "forget-password"
    | "change-email";

export interface AuthOtpEmailInput {
  email: string;
  otp: string;
  type: AuthOtpEmailType;
}

export interface AuthVerificationEmailInput {
  email: string;
  url: string;
  displayName?: string;
}

export interface AuthEmailDeliveryPort {
  sendOtp: (input: AuthOtpEmailInput) => Promise<void>;
  sendVerificationEmail: (input: AuthVerificationEmailInput) => Promise<void>;
}

export interface CreateNovuAuthEmailDeliveryPortOptions {
  subscriberClient: NovuSubscriberClient;
  triggerClient: NovuTriggerClient;
}

function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildAuthEmailSubscriberId(email: string): string {
  return `auth:${normalizeAuthEmail(email)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function formatOtpEmail(input: AuthOtpEmailInput): { subject: string; body: string } {
  const code = escapeHtml(input.otp);

  switch (input.type) {
    case "sign-in":
      return {
        subject: "Your EDAYA sign-in code",
        body: `<p>Use this code to sign in to EDAYA:</p><p><strong style="font-size:24px;letter-spacing:4px;">${code}</strong></p><p>This code expires shortly. If you did not request it, you can ignore this email.</p>`,
      };
    case "email-verification":
      return {
        subject: "Verify your EDAYA email",
        body: `<p>Use this code to verify your email address:</p><p><strong style="font-size:24px;letter-spacing:4px;">${code}</strong></p>`,
      };
    case "forget-password":
      return {
        subject: "Reset your EDAYA password",
        body: `<p>Use this code to reset your password:</p><p><strong style="font-size:24px;letter-spacing:4px;">${code}</strong></p>`,
      };
    case "change-email":
      return {
        subject: "Confirm your new EDAYA email",
        body: `<p>Use this code to confirm your new email address:</p><p><strong style="font-size:24px;letter-spacing:4px;">${code}</strong></p>`,
      };
    default:
      return {
        subject: "Your EDAYA verification code",
        body: `<p><strong style="font-size:24px;letter-spacing:4px;">${code}</strong></p>`,
      };
  }
}

function formatVerificationLinkEmail(input: AuthVerificationEmailInput): { subject: string; body: string } {
  const safeUrl = escapeHtml(input.url);
  const greeting = input.displayName?.trim()
    ? `<p>Hello ${escapeHtml(input.displayName.trim())},</p>`
    : "";

  return {
    subject: "Verify your EDAYA email address",
    body: `${greeting}<p>Confirm your email address to finish creating your EDAYA account.</p><p><a href="${safeUrl}">Verify my email</a></p><p>Or copy this link into your browser:</p><p>${safeUrl}</p>`,
  };
}

async function upsertAuthSubscriber(
  subscriberClient: NovuSubscriberClient,
  email: string,
  displayName?: string,
): Promise<string> {
  const normalizedEmail = normalizeAuthEmail(email);
  const subscriberId = buildAuthEmailSubscriberId(normalizedEmail);

  await subscriberClient.upsert(
    subscriberId,
    AUTH_PLATFORM_CONTEXT_ID,
    {
      schoolId: AUTH_PLATFORM_CONTEXT_ID,
      recipient: {
        kind: MessageDeliveryRecipientKind.Staff,
        id: normalizedEmail,
      },
      displayName: displayName?.trim() || normalizedEmail,
      email: normalizedEmail,
      preferences: {
        allowsNotifications: true,
        channels: {
          email: true,
        },
      },
    },
    { skipWorkflowPreferences: true },
  );

  return subscriberId;
}

export function createNovuAuthEmailDeliveryPort(
  options: CreateNovuAuthEmailDeliveryPortOptions,
): AuthEmailDeliveryPort {
  return {
    sendOtp: async (input) => {
      const normalizedEmail = normalizeAuthEmail(input.email);
      const subscriberId = await upsertAuthSubscriber(
        options.subscriberClient,
        normalizedEmail,
      );
      const { subject, body } = formatOtpEmail(input);
      const transactionId = `auth-otp:${normalizedEmail}:${input.otp}:${Date.now()}`;

      await options.triggerClient.trigger({
        workflowId: AUTH_OTP_EVENT_KEY,
        to: buildNovuTriggerSubscriber({
          subscriberId,
          email: normalizedEmail,
        }),
        transactionId,
        context: {
          tenant: AUTH_PLATFORM_CONTEXT_ID,
        },
        payload: {
          title: subject,
          body,
          emailSubject: subject,
          emailBody: body,
          otp: input.otp,
          kind: "event",
          eventKey: AUTH_OTP_EVENT_KEY,
          schoolId: AUTH_PLATFORM_CONTEXT_ID,
          metadata: {
            otpType: input.type,
          },
        },
      });
    },
    sendVerificationEmail: async (input) => {
      const normalizedEmail = normalizeAuthEmail(input.email);
      const subscriberId = await upsertAuthSubscriber(
        options.subscriberClient,
        normalizedEmail,
        input.displayName,
      );
      const { subject, body } = formatVerificationLinkEmail(input);
      const transactionId = `auth-verify:${normalizedEmail}:${Date.now()}`;

      await options.triggerClient.trigger({
        workflowId: AUTH_EMAIL_VERIFICATION_EVENT_KEY,
        to: buildNovuTriggerSubscriber({
          subscriberId,
          email: normalizedEmail,
          displayName: input.displayName,
        }),
        transactionId,
        context: {
          tenant: AUTH_PLATFORM_CONTEXT_ID,
        },
        payload: {
          title: subject,
          body,
          emailSubject: subject,
          emailBody: body,
          url: input.url,
          verifyUrl: input.url,
          kind: "event",
          eventKey: AUTH_EMAIL_VERIFICATION_EVENT_KEY,
          schoolId: AUTH_PLATFORM_CONTEXT_ID,
          metadata: {
            verifyUrl: input.url,
          },
        },
      });
    },
  };
}

export function createNovuAuthEmailDeliveryPortFromSecretKey(options: {
  secretKey: string;
  serverURL?: string;
}): AuthEmailDeliveryPort {
  return createNovuAuthEmailDeliveryPort({
    subscriberClient: createNovuSubscriberClient(options),
    triggerClient: createNovuSdkClient(options),
  });
}
