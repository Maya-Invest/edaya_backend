import type { SmsProviderPort } from "@edaya/core";

export interface AfricasTalkingOptions {
  username: string;
  apiKey: string;
  senderId?: string;
  sandbox: boolean;
}

export function createAfricasTalkingSms(options: AfricasTalkingOptions, request: (url: string, init: RequestInit) => Promise<Response> = fetch): SmsProviderPort {
  if (![options.username, options.apiKey].every(value => value.trim()))
    throw new Error("Africa's Talking requires username and API key");
  if (options.sandbox && options.username !== "sandbox")
    throw new Error("Africa's Talking sandbox requires username sandbox");
  const senderId = options.senderId?.trim();
  return {
    async send(message) {
      try {
        const response = await request(`https://${options.sandbox ? "api.sandbox" : "api"}.africastalking.com/version1/messaging`, {
          method: "POST",
          signal: AbortSignal.timeout(10000),
          headers: { "apiKey": options.apiKey, "content-type": "application/x-www-form-urlencoded", "accept": "application/json" },
          body: new URLSearchParams({ username: options.username, to: message.to, ...(senderId ? { from: senderId } : {}), message: message.body }),
        });
        // HTTP failures alone do not establish that the message was rejected.
        if (!response.ok)
          return { status: "uncertain" };
        const body = await response.json() as { SMSMessageData?: { Recipients?: { number?: string; statusCode?: number; messageId?: string }[] } };
        const recipients = body.SMSMessageData?.Recipients;
        const matches = Array.isArray(recipients) ? recipients.filter(r => r?.number === message.to) : [];
        if (matches.length !== 1)
          return { status: "uncertain" };
        const recipient = matches[0]!;
        if ([100, 101, 102].includes(recipient.statusCode ?? -1))
          return typeof recipient.messageId === "string" && recipient.messageId.trim() ? { status: "accepted", messageId: recipient.messageId } : { status: "uncertain" };
        if ([402, 403, 404, 405, 406, 407, 502].includes(recipient.statusCode ?? -1))
          return { status: "rejected", reason: `SMS_AT_REJECTED_${recipient.statusCode}`, retryable: false };
        // Risk holds, server failures and unknown codes may still lead to delivery.
        return { status: "uncertain" };
      }
      catch {
        return { status: "uncertain" };
      }
    },
  };
}

export function createLogSmsProvider(log: (message: string, extra?: Record<string, unknown>) => void): SmsProviderPort {
  return {
    async send(message) {
      log("SMS log transport", { attemptId: message.attemptId });
      return { status: "accepted", messageId: `log-sms:${message.attemptId}` };
    },
  };
}
