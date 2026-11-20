import type { SmsTransportPort } from "@edaya/core";
import { smsMessageReference } from "@edaya/core";
import { createLogSmsProvider } from "@edaya/adaptor-sms";

export function createLogSmsTransport(log: (message: string, extra?: Record<string, unknown>) => void): SmsTransportPort {
  const provider = createLogSmsProvider(log);
  return {
    implemented: true,
    async send(input) {
      const result = await provider.send({ to: input.to, body: input.body, attemptId: input.idempotencyKey });
      return result.status === "accepted" ? { status: "accepted", providerMessageId: smsMessageReference("log", result.messageId) } : result;
    },
  };
}
