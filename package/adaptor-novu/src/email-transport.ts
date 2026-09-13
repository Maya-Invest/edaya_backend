import type { EmailTransportPort } from "@edaya/adaptor-notify";
import { Novu } from "@novu/api";

export const NOVU_EMAIL_WORKFLOW_ID = "transactional.email";

export interface NovuEmailRequest {
  workflowId: string;
  transactionId: string;
  to: { subscriberId: string };
  overrides: { email: { to: string[]; replaceToRecipient: true; from: string; senderName?: string; text?: string } };
  payload: Record<string, unknown>;
}
export interface NovuEmailClient {
  trigger: (request: NovuEmailRequest, idempotencyKey: string) => Promise<unknown>;
}
export interface CreateNovuSdkClientOptions {
  secretKey: string;
  serverURL?: string;
}

/** A single immediate email step. Authorization and channels belong to the school dispatcher. */
export function createNovuEmailTransport(client: NovuEmailClient): EmailTransportPort {
  return {
    async send(input) {
      await client.trigger({
        workflowId: NOVU_EMAIL_WORKFLOW_ID,
        transactionId: input.idempotencyKey,
        to: { subscriberId: `email:${input.idempotencyKey}` },
        overrides: { email: { to: [input.to], replaceToRecipient: true, from: input.from.email, senderName: input.from.name, text: input.text } },
        payload: {
          title: input.subject,
          body: input.text ?? input.html,
          emailSubject: input.subject,
          emailBody: input.html,
          ...input.correlation,
        },
      }, input.idempotencyKey);
      return { providerMessageId: input.idempotencyKey };
    },
  };
}

export function createNovuEmailTransportFromSecretKey(options: CreateNovuSdkClientOptions): EmailTransportPort {
  return createNovuEmailTransport(new Novu(options));
}
