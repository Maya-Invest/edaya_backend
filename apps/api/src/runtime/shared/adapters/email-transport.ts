import type { EmailTransportPort } from "@edaya/core";
import { createCloudflareEmailTransport, createLogEmailTransport } from "@edaya/adaptor-notify";
import type { Environment } from "@/runtime/shared/env/schema";

export function resolveEmailTransport(
  env: Environment,
  log: (message: string, extra?: Record<string, unknown>) => void,
): EmailTransportPort {
  if (env.EMAIL_TRANSPORT === "smtp") {
    throw new Error("SMTP email transport is not implemented yet — set EMAIL_TRANSPORT=cloudflare or log");
  }
  if (env.RUNTIME === "worker" && env.EMAIL_TRANSPORT !== "log") {
    if (!env.EMAIL) {
      throw new Error("EMAIL_TRANSPORT=cloudflare requires the EMAIL send_email binding");
    }
    return createCloudflareEmailTransport(env.EMAIL);
  }
  return createLogEmailTransport(log);
}
