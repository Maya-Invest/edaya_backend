import type { CloudflareEmailBinding } from "./email/cloudflare";

export type NotifyEmailTransportKind = "log" | "cloudflare" | "smtp";

export interface NotifyTransportEnv {
  EMAIL_TRANSPORT?: NotifyEmailTransportKind | string;
  EMAIL_FROM?: string;
  EMAIL?: CloudflareEmailBinding;
  FCM_SERVICE_ACCOUNT_JSON?: string;
}

export const DEFAULT_EMAIL_FROM = "EDAYA <noreply@edayaplus.com>";

export function parseNotifyFromAddress(value: string): { email: string; name?: string } {
  const match = value.match(/^([^<]*)<([^>]+)>$/);
  if (!match) {
    return { email: value.trim() };
  }
  const name = match[1]?.trim();
  const email = match[2]?.trim() ?? value.trim();
  return name ? { email, name } : { email };
}
