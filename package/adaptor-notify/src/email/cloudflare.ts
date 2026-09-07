import type { EmailSendInput, EmailTransportPort } from "./port";

export interface CloudflareEmailBinding {
  send: (message: {
    to: string | string[];
    from: { email: string; name?: string } | string;
    subject: string;
    html?: string;
    text?: string;
  }) => Promise<{ messageId?: string }>;
}

export function createCloudflareEmailTransport(binding: CloudflareEmailBinding): EmailTransportPort {
  return {
    async send(input: EmailSendInput) {
      const response = await binding.send({
        to: input.to,
        from: input.from,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return { providerMessageId: response.messageId };
    },
  };
}
