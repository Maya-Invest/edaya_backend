import process from "node:process";
import { z } from "zod";

const envBoolean = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
      return true;
    case "0":
    case "false":
      return false;
    default:
      return value;
  }
}, z.boolean());
export function parseCanonicalHttpOrigin(value: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(value);
  }
  catch {
    return undefined;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return undefined;
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return undefined;
  }
  if (parsed.hostname.includes("*")) {
    return undefined;
  }
  if (parsed.pathname !== "" && parsed.pathname !== "/") {
    return undefined;
  }
  if (value !== parsed.origin) {
    return undefined;
  }
  return parsed.origin;
}
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "10.0.2.2", "[::1]", "::1"]);
/**
 * Map device-local aliases of an allowlisted API origin.
 * Android emulator `10.0.2.2` and `127.0.0.1` mint the same `aud` as `localhost`.
 */
export function resolveAllowlistedApiOrigin(requested: string, allowlist: readonly string[]): string | undefined {
  if (allowlist.includes(requested)) {
    return requested;
  }
  const origin = parseCanonicalHttpOrigin(requested);
  if (!origin) {
    return undefined;
  }
  const requestedUrl = new URL(origin);
  if (!LOOPBACK_HOSTS.has(requestedUrl.hostname)) {
    return undefined;
  }
  for (const allowed of allowlist) {
    const allowedOrigin = parseCanonicalHttpOrigin(allowed);
    if (!allowedOrigin) {
      continue;
    }
    const allowedUrl = new URL(allowedOrigin);
    if (LOOPBACK_HOSTS.has(allowedUrl.hostname)
      && allowedUrl.protocol === requestedUrl.protocol
      && allowedUrl.port === requestedUrl.port) {
      return allowedOrigin;
    }
  }
  return undefined;
}
function firstPartyOriginIssues(raw: string, nodeEnv: string): string[] {
  const issues: string[] = [];
  const entries = raw.split(",").map(origin => origin.trim()).filter(Boolean);
  if (entries.length === 0) {
    return ["At least one first-party API origin is required"];
  }
  const origins: string[] = [];
  for (const entry of entries) {
    const origin = parseCanonicalHttpOrigin(entry);
    if (!origin) {
      issues.push(`Invalid first-party API origin: ${entry}`);
      continue;
    }
    if (nodeEnv === "production" && origin.startsWith("http:")) {
      issues.push(`Production first-party API origins must use HTTPS: ${entry}`);
      continue;
    }
    origins.push(origin);
  }
  if (new Set(origins).size !== origins.length) {
    issues.push("FIRST_PARTY_API_ORIGINS must not contain duplicates");
  }
  return issues;
}
export function parseFirstPartyApiOrigins(raw: string): readonly string[] {
  const origins = raw
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)
    .map(entry => parseCanonicalHttpOrigin(entry))
    .filter((origin): origin is string => origin !== undefined);
  return Object.freeze([...new Set(origins)]);
}
const RawEnvSchema = z.object({
  RUNTIME: z.enum(["local", "worker", "test"]).default("local"),
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9900),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  AUTH_DATABASE_URL: z.string().default("pglite:.data/identity"),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  FIRST_PARTY_API_ORIGINS: z.string().min(1),
  SCHOOL_API_ORIGIN: z.string().optional(),
  TRUSTED_ORIGINS: z.string().default("http://localhost:5173,http://localhost:4173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5175"),
  WEBAPP_ORIGIN: z.string().url().optional(),
  IDENTITY_DIRECTORY_SECRET: z.string().min(1),
  REQUIRE_PRIVILEGED_TOTP: envBoolean.optional(),
  ACCOUNT_POLICY_URL: z.string().url().optional(),
  AUTH_PROVIDER_GENERATION: z.string().default("better-auth:v1"),
  ACCOUNT_SECURITY_KEYS: z.string().optional(),
  ACCOUNT_SECURITY_KEY_VERSION: z.string().regex(/^[\w-]+$/).default("v1"),
  TELEGRAM_GATEWAY_TOKEN: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().regex(/^\d+$/).optional(),
  WHATSAPP_AUTH_TEMPLATE: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().regex(/^v\d+\.\d+$/).optional(),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().default("en_US"),
  REQUIRE_EMAIL_VERIFICATION: envBoolean.optional(),
  AUTH_EMAIL_LOG_OTP: envBoolean.optional(),
  AUTH_DEV_OTP_PEEK: envBoolean.optional(),
  EMAIL_FROM: z.string().default("EDAYA <noreply@edayaplus.com>"),
  EMAIL_TRANSPORT: z.enum(["log", "cloudflare"]).optional(),
}).superRefine((env, ctx) => {
  if (env.SCHOOL_API_ORIGIN !== undefined && env.SCHOOL_API_ORIGIN.trim() !== "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SCHOOL_API_ORIGIN"],
      message: "SCHOOL_API_ORIGIN was removed; set FIRST_PARTY_API_ORIGINS instead",
    });
  }
  if (env.AUTH_DEV_OTP_PEEK === true && env.NODE_ENV === "production") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AUTH_DEV_OTP_PEEK"],
      message: "AUTH_DEV_OTP_PEEK is not allowed in production",
    });
  }
  if (env.NODE_ENV === "production" && env.IDENTITY_DIRECTORY_SECRET === "local-directory-secret") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["IDENTITY_DIRECTORY_SECRET"],
      message: "Production requires an explicit identity directory secret",
    });
  }
  for (const message of firstPartyOriginIssues(env.FIRST_PARTY_API_ORIGINS, env.NODE_ENV)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["FIRST_PARTY_API_ORIGINS"],
      message,
    });
  }
});
export const EnvSchema = RawEnvSchema.transform((env) => {
  const { SCHOOL_API_ORIGIN: _removed, ...rest } = env;
  return {
    ...rest,
    firstPartyApiOrigins: parseFirstPartyApiOrigins(env.FIRST_PARTY_API_ORIGINS),
  };
});
export interface CloudflareEmailBinding {
  send: (message: {
    to: string;
    from: {
      email: string;
      name?: string;
    } | string;
    subject: string;
    html?: string;
    text?: string;
  }) => Promise<void | {
    messageId?: string;
  }>;
}
export type Environment = z.infer<typeof EnvSchema> & {
  EMAIL?: CloudflareEmailBinding;
  AUTH_KV?: unknown;
  HYPERDRIVE_AUTH?: {
    connectionString?: string;
  };
};
export function parseEnv(source: Record<string, unknown>, runtime: Environment["RUNTIME"]): Environment {
  const hyperdrive = source.HYPERDRIVE_AUTH;
  const authDatabaseUrl = runtime === "worker"
    && hyperdrive
    && typeof hyperdrive === "object"
    && typeof (hyperdrive as {
      connectionString?: string;
    }).connectionString === "string"
    ? (hyperdrive as {
        connectionString: string;
      }).connectionString
    : source.AUTH_DATABASE_URL;
  const parsed = EnvSchema.parse({
    ...source,
    RUNTIME: source.RUNTIME ?? runtime,
    AUTH_DATABASE_URL: authDatabaseUrl,
  });
  return { ...parsed, EMAIL: source.EMAIL as Environment["EMAIL"], AUTH_KV: source.AUTH_KV, HYPERDRIVE_AUTH: source.HYPERDRIVE_AUTH as Environment["HYPERDRIVE_AUTH"] };
}
export function loadLocalProcessEnv(): Environment {
  return parseEnv(process.env as Record<string, unknown>, "local");
}
export function trustedOrigins(env: Environment): string[] {
  return env.TRUSTED_ORIGINS.split(",").map(origin => origin.trim()).filter(Boolean);
}
/** Worker quotas stay tight; local/test identity serves seed + client integration bursts. */
export function authRequestQuota(runtime: Environment["RUNTIME"], workerMaximum: number): number {
  return runtime === "worker" ? workerMaximum : 10000;
}
