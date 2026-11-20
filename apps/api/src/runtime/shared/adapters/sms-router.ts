import type { SmsProviderPort, SmsRouterPort } from "@edaya/core";
import { createAfricasTalkingSms } from "@edaya/adaptor-sms";
import { createSmsRouter } from "@edaya/messaging";
import { z } from "zod";
import { smsEnvironmentFields, validateSmsEnvironment } from "@/lib/sms-config";

const schema = z.object({ ...smsEnvironmentFields, NODE_ENV: z.string().optional(), PHONE_AUTH_MODE: z.enum(["disabled", "sms_only", "whatsapp_first"]).optional() }).superRefine(validateSmsEnvironment);

export function resolveSmsRouter(source: Record<string, unknown>, request?: (url: string, init: RequestInit) => Promise<Response>): SmsRouterPort {
  const env = schema.parse(source);
  const active = (env.PHONE_AUTH_MODE ?? "disabled") !== "disabled" || env.SMS_TRANSPORT === "router";
  const providers: Record<string, SmsProviderPort> = {};
  if (active) {
    providers.africas_talking = createAfricasTalkingSms({ username: env.AFRICAS_TALKING_USERNAME!, apiKey: env.AFRICAS_TALKING_API_KEY!, senderId: env.AFRICAS_TALKING_SENDER_ID, sandbox: env.AFRICAS_TALKING_SANDBOX }, request);
  }
  return createSmsRouter(active ? env.SMS_ROUTES : [], providers);
}
