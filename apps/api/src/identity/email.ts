import type { CloudflareEmailBinding, Environment } from "./env";
import { createLocalEmailBinding } from "./local-email";

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
interface AuthEmailLogger {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
function otpCodeHtml(code: string): string {
  return `<p><strong style="font-size:24px;letter-spacing:4px;">${escapeHtml(code)}</strong></p>`;
}
function formatOtpEmail(input: {
  otp: string;
  type: AuthOtpType;
}): {
  subject: string;
  html: string;
  text: string;
} {
  const codeHtml = otpCodeHtml(input.otp);
  switch (input.type) {
    case "sign-in":
      return {
        subject: "Your EDAYA sign-in code",
        html: `<p>Use this code to sign in to EDAYA:</p>${codeHtml}<p>This code expires shortly. If you did not request it, you can ignore this email.</p>`,
        text: `Use this code to sign in to EDAYA:\n\n${input.otp}\n\nThis code expires shortly. If you did not request it, you can ignore this email.`,
      };
    case "email-verification":
      return {
        subject: "Verify your EDAYA email",
        html: `<p>Use this code to verify your email address:</p>${codeHtml}`,
        text: `Use this code to verify your email address:\n\n${input.otp}`,
      };
    case "forget-password":
      return {
        subject: "Reset your EDAYA password",
        html: `<p>Use this code to reset your password:</p>${codeHtml}`,
        text: `Use this code to reset your password:\n\n${input.otp}`,
      };
    case "change-email":
      return {
        subject: "Confirm your new EDAYA email",
        html: `<p>Use this code to confirm your new email address:</p>${codeHtml}`,
        text: `Use this code to confirm your new email address:\n\n${input.otp}`,
      };
    default:
      return {
        subject: "Your EDAYA verification code",
        html: codeHtml,
        text: input.otp,
      };
  }
}
function formatVerificationLinkEmail(input: {
  url: string;
  displayName?: string;
}): {
  subject: string;
  html: string;
  text: string;
} {
  const safeUrl = escapeHtml(input.url);
  const greetingName = input.displayName?.trim();
  const greetingHtml = greetingName ? `<p>Hello ${escapeHtml(greetingName)},</p>` : "";
  const greetingText = greetingName ? `Hello ${greetingName},\n\n` : "";
  return {
    subject: "Verify your EDAYA email address",
    html: `${greetingHtml}<p>Confirm your email address to finish creating your EDAYA account.</p><p><a href="${safeUrl}">Verify my email</a></p><p>Or copy this link into your browser:</p><p>${safeUrl}</p>`,
    text: `${greetingText}Confirm your email address to finish creating your EDAYA account.\n\nVerify my email: ${input.url}`,
  };
}
function parseFromAddress(value: string): {
  email: string;
  name?: string;
} {
  const match = value.match(/^([^<]*)<([^>]+)>$/);
  if (!match) {
    return { email: value.trim() };
  }
  const name = match[1]?.trim();
  const email = match[2]?.trim() ?? value.trim();
  return name ? { email, name } : { email };
}
function shouldLogAuthEmailInDev(env: Environment): boolean {
  return env.NODE_ENV === "development";
}
async function sendCloudflareEmail(env: Environment, binding: CloudflareEmailBinding, to: string, copy: {
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const from = parseFromAddress(env.EMAIL_FROM);
  await binding.send({
    to,
    from: from.name ? { email: from.email, name: from.name } : from.email,
    subject: copy.subject,
    html: copy.html,
    text: copy.text,
  });
}
export function createAuthEmailSenders(env: Environment, log: AuthEmailLogger, options: {
  /** Only the dedicated testing server opts into delivery while NODE_ENV=test. */
  allowTestDelivery?: boolean;
  send?: (url: string, init: RequestInit) => Promise<Response>;
} = {}) {
  const suppressed = env.NODE_ENV === "test" && !options.allowTestDelivery;
  const binding = suppressed
    ? undefined
    : (env.EMAIL_TRANSPORT === "cloudflare" && env.EMAIL)
      || createLocalEmailBinding(env, message => log.warn({}, message), options.send);
  async function sendAuthVerificationOtp(input: AuthOtpDeliveryInput): Promise<void> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const copy = formatOtpEmail(input);
    if (suppressed) {
      return;
    }
    if (binding) {
      await sendCloudflareEmail(env, binding, normalizedEmail, copy);
      if (shouldLogAuthEmailInDev(env)) {
        log.info({ email: normalizedEmail, type: input.type, delivery: "cloudflare" }, "Auth OTP sent");
      }
      return;
    }
    if (env.NODE_ENV === "production") {
      throw new Error("Auth OTP email delivery is not configured for production");
    }
    log.info({ email: normalizedEmail, type: input.type, delivery: "log" }, "Auth delivery omitted locally; use bun repo dev for captured OTP access");
  }
  async function sendAuthVerificationEmail(input: AuthVerificationEmailInput): Promise<void> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const copy = formatVerificationLinkEmail(input);
    if (suppressed) {
      return;
    }
    if (binding) {
      await sendCloudflareEmail(env, binding, normalizedEmail, copy);
      if (shouldLogAuthEmailInDev(env)) {
        log.info({ email: normalizedEmail, delivery: "cloudflare" }, "Auth verification email sent");
      }
      return;
    }
    if (env.NODE_ENV === "production") {
      log.warn({ email: normalizedEmail }, "Auth verification email delivery is not configured for production");
      return;
    }
    log.info({ email: normalizedEmail, delivery: "log" }, "Auth verification email (set EMAIL_TRANSPORT=cloudflare for real email delivery)");
  }
  return {
    canDeliverEmail: !!binding,
    async sendTeacherCode(to: string, message: string) {
      if (!binding) throw new Error("Email unavailable");
      await sendCloudflareEmail(env, binding, to, { subject: "EDAYA · Code enseignant / Teacher code", html: `<p>${escapeHtml(message)}</p>`, text: message });
    },
    sendAuthVerificationOtp,
    sendAuthVerificationEmail,
  };
}
