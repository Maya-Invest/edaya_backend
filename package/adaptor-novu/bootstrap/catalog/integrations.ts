import type { BootstrapIntegrationDefinition } from "../lib/types";

export const EDAYA_EMAIL_WEBHOOK_IDENTIFIER = "edaya-email-webhook";

export interface EmailWebhookIntegrationInput {
  webhookUrl: string;
  secretKey: string;
  from: string;
  senderName: string;
}

export function buildEmailWebhookIntegration(
  input: EmailWebhookIntegrationInput,
): BootstrapIntegrationDefinition {
  return {
    identifier: EDAYA_EMAIL_WEBHOOK_IDENTIFIER,
    name: "Edaya Email Webhook",
    providerId: "email-webhook",
    channel: "email",
    active: true,
    primary: true,
    credentials: {
      webhookUrl: input.webhookUrl,
      secretKey: input.secretKey,
      hmac: true,
      from: input.from,
      senderName: input.senderName,
    },
  };
}
