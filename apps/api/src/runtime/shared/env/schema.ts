import type { D1Database } from "@cloudflare/workers-types";
import { inferRuntimeKind, prepareRuntimeBindings } from "@/runtime/shared/env/bindings";
import type { RuntimeBindings, RuntimeKind } from "@/runtime/types";
import { z } from "zod";

const envBooleanSchema = z.preprocess((value) => {
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

export const EnvSchema = z.object({
  RUNTIME: z.enum(["in-memory", "local", "worker"]).default("local"),
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string(),
  AUTH_DATABASE_PATH: z.string().default(".data/auth.sqlite"),
  RUN_MIGRATIONS_ON_STARTUP: envBooleanSchema.optional(),
  BETTER_AUTH_SECRET: z.string().default("super-secret-placeholder-key-for-local-testing"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:9999"),
  TRUSTED_ORIGINS: z.string().default("http://localhost:5173,http://localhost:4173"),
  COOKIE_DOMAIN: z.string().optional(),
  GRANTS_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
  /** Novu Cloud secret key — when set, notifications dispatch via @edaya/adaptor-novu */
  NOVU_SECRET_KEY: z.string().min(1).optional(),
  /** Optional Novu API base URL (e.g. https://eu.api.novu.co) */
  NOVU_API_URL: z.string().url().optional(),
  /** Provider webhook signing secret (Novu: Svix) — required for POST /webhooks/notification-delivery */
  NOVU_WEBHOOK_SECRET: z.string().min(1).optional(),
  /** When true, allow POST /core/onboarding/register-school for authenticated unlinked users. */
  ALLOW_PUBLIC_SCHOOL_REGISTRATION: z.coerce.boolean().optional(),
  /** Webapp origin used to build invitation accept links, e.g. http://localhost:5173 */
  WEBAPP_ORIGIN: z.string().url().optional(),
  /** When false, account invitations are disabled (auto-invite and manual send). Defaults to true. */
  ACCOUNT_INVITATIONS_ENABLED: envBooleanSchema.optional(),
  /** Cloudflare account id (dashboard). Optional when R2_ENDPOINT is set; may differ from the endpoint hostname. */
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  /** Jurisdiction-specific R2 S3 API endpoint from the R2 dashboard — authoritative for all S3 API calls. */
  R2_ENDPOINT: z.string().url().optional(),
  /** R2 API token access key id */
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  /** R2 API token secret access key */
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /** R2 bucket name — separate bucket per environment */
  R2_BUCKET_NAME: z.string().min(1).optional(),
});

export type Environment = z.infer<typeof EnvSchema> & {
  AUTH_DB?: D1Database;
};

export function parseEnv(data: Record<string, unknown>) {
  const { data: env, error } = EnvSchema.safeParse(data);

  if (error) {
    const errorMessage = `❌ Invalid env - ${Object.entries(error.flatten().fieldErrors).map(([key, errors]) => `${key}: ${errors.join(",")}`).join(" | ")}`;
    throw new Error(errorMessage);
  }

  return env;
}

export function readAuthDbBinding(source: RuntimeBindings): D1Database | undefined {
  const binding = source.AUTH_DB;
  if (binding && typeof binding === "object" && "prepare" in binding) {
    return binding as D1Database;
  }
  return undefined;
}

export function parseRuntimeEnv(
  source: RuntimeBindings,
  runtime: RuntimeKind = inferRuntimeKind(source),
): Environment {
  const bindings = prepareRuntimeBindings(source, runtime);
  const env = parseEnv(bindings);
  const authDb = readAuthDbBinding(source);
  return authDb ? { ...env, AUTH_DB: authDb } : env;
}
