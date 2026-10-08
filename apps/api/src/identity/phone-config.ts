import type { SmsRoute } from "@edaya/core";
import { z } from "zod";

function json(value: unknown) {
  if (typeof value !== "string")
    return value;
  try {
    return JSON.parse(value) as unknown;
  }
  catch { return value; }
}
const template = z.object({ name: z.string().min(1).regex(/^[a-z0-9_]+$/), language: z.string().min(2).max(16) }).strict();
export const templatesSchema = z.preprocess(json, z.object({ fr: template, en: template }).strict());

/** Intersect transport routes with the existing CI mobile authentication policy. */
export function phoneSmsPrefixes(routes: readonly SmsRoute[]): string[] {
  return [...new Set(routes.filter(route => route.prefix.length <= 14 && ["+22501", "+22505", "+22507"].some(prefix => prefix.startsWith(route.prefix) || route.prefix.startsWith(prefix))).map(route => route.prefix.length < 4 ? "+225" : route.prefix))];
}
