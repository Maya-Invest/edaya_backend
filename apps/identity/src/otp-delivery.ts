import type { OtpDeliveryPort } from "@edaya/account";
import type { Environment } from "./env";
import { createAuthEmailSenders } from "./email";
import { createAppLogger } from "./logger";
import { smsRoute } from "./phone-config";

export function createOtpDelivery(env: Environment, send: (url: string, init: RequestInit) => Promise<Response> = fetch): OtpDeliveryPort {
  const email = createAuthEmailSenders(env, createAppLogger(env));
  return { async send(input) {
    if (input.channel === "email") {
      await email.sendAuthVerificationOtp({ email: input.destination, otp: input.code, type: "sign-in" });
      return;
    }
    if (env.PHONE_AUTH_MODE === "disabled")
      return { status: "failed" };
    try {
      if (input.channel === "sms") {
        if (!smsRoute(env.PHONE_SMS_ROUTES, input.destination) || !env.AFRICAS_TALKING_USERNAME || !env.AFRICAS_TALKING_API_KEY || !env.AFRICAS_TALKING_SENDER_ID)
          return { status: "failed" };
        const response = await send(`https://${env.AFRICAS_TALKING_SANDBOX ? "api.sandbox" : "api"}.africastalking.com/version1/messaging`, {
          method: "POST",
          signal: AbortSignal.timeout(10000),
          headers: { "apiKey": env.AFRICAS_TALKING_API_KEY, "content-type": "application/x-www-form-urlencoded", "accept": "application/json" },
          body: new URLSearchParams({ username: env.AFRICAS_TALKING_USERNAME, to: input.destination, from: env.AFRICAS_TALKING_SENDER_ID, message: input.locale === "en" ? `Your EDAYA verification code is ${input.code}. Valid for 5 minutes. Use the most recent code.` : `Votre code de verification EDAYA est ${input.code}. Valable 5 minutes. Utilisez le dernier code recu.` }),
        });
        if (!response.ok)
          return { status: response.status >= 500 ? "uncertain" : "failed" };
        const body = await response.json() as { SMSMessageData?: { Recipients?: { number?: string; statusCode?: number; messageId?: string }[] } };
        const recipient = body.SMSMessageData?.Recipients?.find(r => r.number === input.destination);
        if (!recipient)
          return { status: "uncertain" };
        if (recipient.statusCode === 101)
          return typeof recipient.messageId === "string" && recipient.messageId.length > 0 ? { status: "accepted", messageId: recipient.messageId } : { status: "uncertain" };
        return typeof recipient.statusCode === "number" ? { status: "failed" } : { status: "uncertain" };
      }
      const template = env.WHATSAPP_AUTH_TEMPLATES?.[input.locale ?? "fr"];
      if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !template || !env.WHATSAPP_API_VERSION)
        return { status: "failed" };
      const response = await send(`https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: { "authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: input.destination.slice(1), type: "template", biz_opaque_callback_data: input.attemptId, template: { name: template.name, language: { code: template.language }, components: [{ type: "body", parameters: [{ type: "text", text: input.code }] }, { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: input.code }] }] } }),
      });
      if (!response.ok)
        return { status: response.status >= 500 ? "uncertain" : "failed" };
      const body = await response.json() as { messages?: { id?: string }[] };
      const messageId = body.messages?.[0]?.id;
      return typeof messageId === "string" && messageId.length > 0 ? { status: "accepted", messageId } : { status: "uncertain" };
    }
    catch {
      // A timeout may have been accepted remotely. Never retry or switch channels.
      return { status: "uncertain" };
    }
  } };
}
