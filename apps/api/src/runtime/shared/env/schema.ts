import { inferRuntimeKind, prepareRuntimeBindings } from "@/runtime/shared/env/bindings";
import type { CronJobsQueueBinding } from "@/runtime/worker/adapters/cloudflare-queue-cron-job-dispatcher";
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
  /** Worker auth DB (cache-disabled Hyperdrive). Falls back to DATABASE_URL when unset. */
  AUTH_DATABASE_URL: z.string().optional(),
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
  /** When true, require verified email before password sign-in. Defaults to true when NOVU_SECRET_KEY is set. */
  REQUIRE_EMAIL_VERIFICATION: envBooleanSchema.optional(),
  /** When false, skip logging auth OTP / verification URLs in development even when Novu sends. */
  AUTH_EMAIL_LOG_OTP: envBooleanSchema.optional(),
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
  /** Local dev file storage service base URL (default http://localhost:9200) */
  LOCAL_FILES_URL: z.string().url().optional(),
  /** Local dev file storage root directory (default .data/files) */
  LOCAL_FILES_ROOT: z.string().min(1).optional(),
  /** Shared secret for local file storage tokens and internal API (defaults to BETTER_AUTH_SECRET) */
  LOCAL_FILES_SECRET: z.string().min(1).optional(),
  /** Local one-shot cron (`bun cron:local`): comma-separated job keys; default runs heartbeat tick */
  CRON_JOB_KEYS: z.string().optional(),
});

export type Environment = z.infer<typeof EnvSchema> & {
  CRON_JOBS?: CronJobsQueueBinding;
};

export function parseEnv(data: Record<string, unknown>) {
  const { data: env, error } = EnvSchema.safeParse(data);

  if (error) {
    const errorMessage = `❌ Invalid env - ${Object.entries(error.flatten().fieldErrors).map(([key, errors]) => `${key}: ${errors.join(",")}`).join(" | ")}`;
    throw new Error(errorMessage);
  }

  return env;
}

export function readCronJobsQueueBinding(source: RuntimeBindings): CronJobsQueueBinding | undefined {
  const binding = source.CRON_JOBS;
  if (binding && typeof binding === "object" && "send" in binding && typeof binding.send === "function") {
    return binding as CronJobsQueueBinding;
  }
  return undefined;
}

export function parseRuntimeEnv(
  source: RuntimeBindings,
  runtime: RuntimeKind = inferRuntimeKind(source),
): Environment {
  const bindings = prepareRuntimeBindings(source, runtime);
  const env = parseEnv(bindings);
  const cronJobs = readCronJobsQueueBinding(source);

  return {
    ...env,
    ...(cronJobs ? { CRON_JOBS: cronJobs } : {}),
  };
}
