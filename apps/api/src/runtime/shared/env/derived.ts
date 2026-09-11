import type { Environment } from "@/runtime/shared/env/schema";

const DEFAULT_WEBAPP_ORIGIN = "http://localhost:5173";

export type WebappOriginEnv = Pick<
  Partial<Environment>,
  "WEBAPP_ORIGIN" | "TRUSTED_ORIGINS" | "NODE_ENV"
>;

export function shouldAllowPublicSchoolRegistration(env: Environment): boolean {
  if (env.ALLOW_PUBLIC_SCHOOL_REGISTRATION === true) {
    return true;
  }
  if (env.ALLOW_PUBLIC_SCHOOL_REGISTRATION === false) {
    return false;
  }
  return env.NODE_ENV === "development";
}

export function resolveWebappOrigin(env: WebappOriginEnv | undefined): string | undefined {
  const origin = env?.WEBAPP_ORIGIN?.trim()
    || env?.TRUSTED_ORIGINS?.split(",")[0]?.trim()
    || (env?.NODE_ENV === "development" ? DEFAULT_WEBAPP_ORIGIN : undefined);

  if (!origin) {
    return undefined;
  }

  return origin.replace(/\/+$/, "");
}

export function resolveInviteBaseUrl(env: Environment | undefined): string | undefined {
  const origin = resolveWebappOrigin(env);
  if (!origin) {
    return undefined;
  }

  return `${origin}/invite`;
}

export function resolveAccountInvitationsEnabled(env: Environment | undefined): boolean {
  return env?.ACCOUNT_INVITATIONS_ENABLED !== false;
}
