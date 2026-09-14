import type { SmsTransportPort } from "@edaya/core";
import { createLogSmsTransport, createUnimplementedSmsTransport } from "@edaya/adaptor-notify";
import type { Environment } from "@/runtime/shared/env/schema";

export function resolveSmsTransport(
  env: Environment,
  log: (message: string, extra?: Record<string, unknown>) => void,
): SmsTransportPort {
  if (env.SMS_TRANSPORT && env.SMS_TRANSPORT !== "log" && env.SMS_TRANSPORT !== "unimplemented") {
    throw new Error("SMS transport is not implemented yet — set SMS_TRANSPORT=log or omit it");
  }
  if (env.RUNTIME === "worker" && env.SMS_TRANSPORT !== "log") {
    return createUnimplementedSmsTransport();
  }
  return createLogSmsTransport(log);
}
