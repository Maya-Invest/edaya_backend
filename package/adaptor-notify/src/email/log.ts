import type { EmailSendInput, EmailTransportPort } from "./port";

export function createLogEmailTransport(log: (message: string, extra?: Record<string, unknown>) => void): EmailTransportPort {
  return {
    async send(input: EmailSendInput) {
      log("notify email (log transport)", {
        to: input.to,
        subject: input.subject,
        idempotencyKey: input.idempotencyKey,
      });
      return { providerMessageId: `log:${input.idempotencyKey}` };
    },
  };
}
