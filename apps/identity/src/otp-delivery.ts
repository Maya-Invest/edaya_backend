import type { OtpDeliveryPort } from "@edaya/account";
import type { Environment } from "./env";
import { createAuthEmailSenders } from "./email";
import { createAppLogger } from "./logger";

export function createOtpDelivery(env: Environment, send: (url: string, init: RequestInit) => Promise<Response> = fetch): OtpDeliveryPort {
  const email = createAuthEmailSenders(env, createAppLogger(env));
  return { async send(input) {
    if (input.channel === "email") {
      await email.sendAuthVerificationOtp({ email: input.destination, otp: input.code, type: "sign-in" });
      return;
    }
    let response: Response;
    if (input.channel === "telegram") {
      if (!env.TELEGRAM_GATEWAY_TOKEN)
        throw new Error("Telegram delivery unavailable");
      response = await send("https://gatewayapi.telegram.org/sendVerificationMessage", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: { "authorization": `Bearer ${env.TELEGRAM_GATEWAY_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ phone_number: input.destination, code: input.code, ttl: 300 }),
      });
      if (!response.ok || (await response.json() as {
        ok?: boolean;
      }).ok !== true) {
        throw new Error("Telegram delivery failed");
      }
    }
    else {
      if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_AUTH_TEMPLATE || !env.WHATSAPP_API_VERSION)
        throw new Error("WhatsApp delivery unavailable");
      response = await send(`https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: { "authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: input.destination.slice(1), type: "template", template: {
          name: env.WHATSAPP_AUTH_TEMPLATE,
          language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE },
          components: [{ type: "body", parameters: [{ type: "text", text: input.code }] }, { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: input.code }] }],
        } }),
      });
      if (!response.ok)
        throw new Error("WhatsApp delivery failed");
    }
    // Ambiguous timeouts are not retried automatically; user resend remains quota controlled.
  } };
}
