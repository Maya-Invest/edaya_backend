import type { Environment } from "@/runtime/env/schema";

const DEFAULT_WEBAPP_ORIGIN = "http://localhost:5173";

export function resolveInviteBaseUrl(env: Environment | undefined): string | undefined {
  const origin = env?.WEBAPP_ORIGIN?.trim()
    || env?.TRUSTED_ORIGINS?.split(",")[0]?.trim()
    || (env?.NODE_ENV === "development" ? DEFAULT_WEBAPP_ORIGIN : undefined);

  if (!origin) {
    return undefined;
  }

  return `${origin.replace(/\/+$/, "")}/invite`;
}

export function resolveAccountInvitationsEnabled(env: Environment | undefined): boolean {
  return env?.ACCOUNT_INVITATIONS_ENABLED !== false;
}
