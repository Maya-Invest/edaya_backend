import { z } from "zod";

function json(value: unknown) {
  if (typeof value !== "string")
    return value;
  try {
    return JSON.parse(value) as unknown;
  }
  catch { return value; }
}
export const smsRoutesSchema = z.preprocess(json, z.array(z.object({ prefix: z.string().regex(/^\+225\d{0,10}$/), provider: z.literal("africas_talking") }).strict()).superRefine((routes, ctx) => {
  if (new Set(routes.map(route => route.prefix)).size !== routes.length)
    ctx.addIssue({ code: "custom", message: "SMS prefixes must be unique" });
}));
const template = z.object({ name: z.string().min(1).regex(/^[a-z0-9_]+$/), language: z.string().min(2).max(16) }).strict();
export const templatesSchema = z.preprocess(json, z.object({ fr: template, en: template }).strict());
export function smsRoute(routes: z.infer<typeof smsRoutesSchema>, phone: string) {
  return routes.filter(route => phone.startsWith(route.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
}
