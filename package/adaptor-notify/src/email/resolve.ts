import type { NotifyTransportEnv } from "../env";
import { DEFAULT_EMAIL_FROM, parseNotifyFromAddress } from "../env";
import { createCloudflareEmailTransport } from "./cloudflare";
import { createLogEmailTransport } from "./log";
import type { EmailTransportPort } from "./port";

export function resolveEmailTransport(
  env: NotifyTransportEnv,
  log: (message: string, extra?: Record<string, unknown>) => void,
): EmailTransportPort {
  if (env.EMAIL_TRANSPORT === "cloudflare") {
    if (!env.EMAIL) {
      throw new Error("EMAIL_TRANSPORT=cloudflare requires the EMAIL send_email binding");
    }
    return createCloudflareEmailTransport(env.EMAIL);
  }
  if (env.EMAIL_TRANSPORT === "smtp") {
    throw new Error("SMTP email transport is not implemented yet — set EMAIL_TRANSPORT=cloudflare or log");
  }
  if (env.EMAIL && env.EMAIL_TRANSPORT !== "log") {
    return createCloudflareEmailTransport(env.EMAIL);
  }
  return createLogEmailTransport(log);
}

export function resolveEmailFrom(env: NotifyTransportEnv): { email: string; name?: string } {
  return parseNotifyFromAddress(env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM);
}
