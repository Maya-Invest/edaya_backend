import { smsMessageReference } from "@edaya/core";
import { resolveSmsRouter } from "./sms-router";
import type { SmsRouterPort, SmsTransportPort } from "@edaya/core";
import { createLogSmsTransport, createUnimplementedSmsTransport } from "@edaya/adaptor-notify";
import type { Environment } from "@/runtime/shared/env/schema";

export function resolveSmsTransport(
  env: Environment,
  log: (message: string, extra?: Record<string, unknown>) => void,
  router?: SmsRouterPort,
): SmsTransportPort {
  if (env.SMS_TRANSPORT === "router") {
    const sms = router ?? resolveSmsRouter(env);
    return { implemented: true, async send(input) {
      const result = await sms.send({ to: input.to, body: input.body, attemptId: input.idempotencyKey });
      return result.status === "accepted" ? { status: "accepted", providerMessageId: smsMessageReference(result.providerId, result.messageId) } : result;
    } };
  }
  if (env.SMS_TRANSPORT && env.SMS_TRANSPORT !== "log" && env.SMS_TRANSPORT !== "unimplemented") {
    throw new Error("SMS transport is not implemented yet — set SMS_TRANSPORT=log or omit it");
  }
  if (env.RUNTIME === "worker" && env.SMS_TRANSPORT !== "log") {
    return createUnimplementedSmsTransport();
  }
  return createLogSmsTransport(log);
}
