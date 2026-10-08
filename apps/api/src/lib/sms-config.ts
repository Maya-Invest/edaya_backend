import { z } from "zod";
import { envBooleanSchema } from "@/runtime/shared/env/boolean";

export const smsRoutesSchema = z.preprocess((value) => {
  if (typeof value !== "string")
    return value;
  try {
    return JSON.parse(value) as unknown;
  }
  catch {
    return value;
  }
}, z.array(z.object({ prefix: z.string().regex(/^\+[1-9]\d{0,14}$/), provider: z.literal("africas_talking") }).strict()).superRefine((routes, ctx) => {
  if (new Set(routes.map(route => route.prefix)).size !== routes.length)
    ctx.addIssue({ code: "custom", message: "SMS prefixes must be unique" });
}));

export const smsEnvironmentFields = {
  SMS_ROUTES: smsRoutesSchema.default([]),
  SMS_TRANSPORT: z.enum(["log", "unimplemented", "router"]).optional(),
  PHONE_SMS_ROUTES: z.unknown().optional(),
  AFRICAS_TALKING_USERNAME: z.string().trim().optional(),
  AFRICAS_TALKING_API_KEY: z.string().trim().optional(),
  AFRICAS_TALKING_SENDER_ID: z.string().trim().optional(),
  AFRICAS_TALKING_SANDBOX: envBooleanSchema.default(false),
};

export function validateSmsEnvironment(env: z.infer<z.ZodObject<typeof smsEnvironmentFields>> & { NODE_ENV?: string; PHONE_AUTH_MODE?: string }, ctx: z.RefinementCtx) {
  if (env.PHONE_SMS_ROUTES !== undefined)
    ctx.addIssue({ code: "custom", path: ["PHONE_SMS_ROUTES"], message: "PHONE_SMS_ROUTES was removed; use sms_routes in the environment config" });
  if (env.NODE_ENV === "production" && env.AFRICAS_TALKING_SANDBOX)
    ctx.addIssue({ code: "custom", path: ["AFRICAS_TALKING_SANDBOX"], message: "SMS sandbox is not allowed in production" });
  if ((env.PHONE_AUTH_MODE ?? "disabled") === "disabled" && env.SMS_TRANSPORT !== "router")
    return;
  if (!env.SMS_ROUTES.length)
    ctx.addIssue({ code: "custom", path: ["SMS_ROUTES"], message: "Enabled delivery requires at least one SMS route" });
  for (const key of ["AFRICAS_TALKING_USERNAME", "AFRICAS_TALKING_API_KEY", "AFRICAS_TALKING_SENDER_ID"] as const) {
    if (!env[key])
      ctx.addIssue({ code: "custom", path: [key], message: `${key} is required for SMS delivery` });
  }
  if (env.AFRICAS_TALKING_SANDBOX && env.AFRICAS_TALKING_USERNAME !== "sandbox")
    ctx.addIssue({ code: "custom", path: ["AFRICAS_TALKING_USERNAME"], message: "Sandbox username must be sandbox" });
}
