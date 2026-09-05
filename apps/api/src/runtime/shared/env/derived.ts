import type { Environment } from "@/runtime/shared/env/schema";

const DEFAULT_WEBAPP_ORIGIN = "http://localhost:5173";
const EMAIL_VERIFIED_LOGIN_PATH = "/login?verified=1";

export type WebappOriginEnv = Pick<
  Partial<Environment>,
  "WEBAPP_ORIGIN" | "TRUSTED_ORIGINS" | "NODE_ENV" | "BETTER_AUTH_URL"
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

export function resolveEmailVerificationCallbackUrl(
  env: WebappOriginEnv | undefined,
): string | undefined {
  const origin = resolveWebappOrigin(env);
  if (!origin) {
    return undefined;
  }

  return `${origin}${EMAIL_VERIFIED_LOGIN_PATH}`;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function trustedWebappOrigins(env: WebappOriginEnv | undefined): Set<string> {
  const origins = new Set<string>();
  const webappOrigin = resolveWebappOrigin(env);
  if (webappOrigin) {
    origins.add(webappOrigin);
  }
  for (const origin of env?.TRUSTED_ORIGINS?.split(",") ?? []) {
    const trimmed = stripTrailingSlash(origin.trim());
    if (trimmed) {
      origins.add(trimmed);
    }
  }
  return origins;
}

function originOf(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.origin;
  }
  catch {
    return undefined;
  }
}

function isTrustedWebappCallback(callbackUrl: string, env: WebappOriginEnv | undefined): boolean {
  const origin = originOf(callbackUrl);
  if (!origin) {
    return false;
  }
  return trustedWebappOrigins(env).has(origin);
}

function isApiOriginCallback(callbackUrl: string, env: WebappOriginEnv | undefined): boolean {
  const apiOrigin = env?.BETTER_AUTH_URL ? originOf(env.BETTER_AUTH_URL) : undefined;
  const callbackOrigin = originOf(callbackUrl);
  return Boolean(apiOrigin && callbackOrigin && apiOrigin === callbackOrigin);
}

export function applyEmailVerificationCallbackUrl(
  verificationUrl: string,
  env: WebappOriginEnv | undefined,
): string {
  const loginCallback = resolveEmailVerificationCallbackUrl(env);
  if (!loginCallback) {
    return verificationUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(verificationUrl);
  }
  catch {
    return verificationUrl;
  }

  const currentCallback = parsed.searchParams.get("callbackURL") ?? "/";
  const isAbsoluteHttp = /^https?:\/\//i.test(currentCallback);
  if (
    isAbsoluteHttp
    && isTrustedWebappCallback(currentCallback, env)
    && !isApiOriginCallback(currentCallback, env)
  ) {
    return verificationUrl;
  }

  parsed.searchParams.set("callbackURL", loginCallback);
  return parsed.toString();
}

export function resolveAccountInvitationsEnabled(env: Environment | undefined): boolean {
  return env?.ACCOUNT_INVITATIONS_ENABLED !== false;
}
