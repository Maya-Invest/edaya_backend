import type { OtpDeliveryPort } from "@edaya/account";
import type { Environment } from "./env";
import { createAuthEmailSenders } from "./email";
import { createAppLogger } from "./logger";
import type { SmsRouterPort } from "@edaya/core";
import { smsMessageReference } from "@edaya/core";
import { resolveSmsRouter } from "@/runtime/shared/adapters/sms-router";

export function createOtpDelivery(env: Environment, send: (url: string, init: RequestInit) => Promise<Response> = fetch, sms: SmsRouterPort = resolveSmsRouter(env, send)): OtpDeliveryPort {
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
        const result = await sms.send({ to: input.destination, attemptId: input.attemptId ?? crypto.randomUUID(), body: input.locale === "en" ? `Your EDAYA verification code is ${input.code}. Valid for 5 minutes. Use the most recent code.` : `Votre code de verification EDAYA est ${input.code}. Valable 5 minutes. Utilisez le dernier code recu.` });
        if (result.status === "accepted")
          return { status: "accepted", messageId: smsMessageReference(result.providerId, result.messageId) };
        return { status: result.status === "rejected" ? "failed" : "uncertain" };
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
