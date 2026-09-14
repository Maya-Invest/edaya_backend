import type { SmsSendInput, SmsTransportPort } from "@edaya/core";

export function createLogSmsTransport(log: (message: string, extra?: Record<string, unknown>) => void): SmsTransportPort {
  return {
    implemented: true,
    async send(input: SmsSendInput) {
      log("notify sms (log transport)", {
        to: input.to,
        idempotencyKey: input.idempotencyKey,
      });
      return { providerMessageId: `log-sms:${input.idempotencyKey}` };
    },
  };
}
