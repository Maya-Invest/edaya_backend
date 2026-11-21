import { validateJobCron } from "@edaya/service";
import { resolveTermsMode, termsModeSchema } from "@/lib/terms-mode";
import { smsEnvironmentFields, validateSmsEnvironment } from "@/lib/sms-config";
import type { BrowserRunBinding } from "@edaya/adaptor-docs";
import type { CloudflareEmailBinding } from "@edaya/adaptor-notify";
import type { RuntimeBindings, RuntimeKind } from "@/runtime/types";
import type { CronJobsQueueBinding } from "@/runtime/worker/adapters/cloudflare-queue-cron-job-dispatcher";
import { z } from "zod";
import { inferRuntimeKind, prepareRuntimeBindings } from "@/runtime/shared/env/bindings";

import { envBooleanSchema } from "./boolean";

export const EnvSchema = z.object({
  RUNTIME: z.enum(["in-memory", "local", "worker"]).default("local"),
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string(),
  REQUIRE_PRIVILEGED_TOTP: envBooleanSchema.optional(),
  RUN_MIGRATIONS_ON_STARTUP: envBooleanSchema.optional(),
  API_ORIGIN: z.string().url().default("http://localhost:9999"),
  TEACHER_QUICK_LOGIN_ENABLED: envBooleanSchema.optional(),
  LOCAL_OTP_CAPTURE: envBooleanSchema.default(false),
  LOCAL_OPERATIONS_ROOT: z.string().optional(),
  LOCAL_HEARTBEAT_MINUTES: z.coerce.number().int().min(1).max(35791).optional(),
  LEGACY_IDENTITY_CLEANUP_CRON: z.string().refine((value) => {
    try {
      // Older bindings can contain a paused purge. New configuration accepts only cron expressions.
      return value === "off" || !!validateJobCron(value);
    }
    catch {
      return false;
    }
  }, "Expected a five-field UTC cron expression").optional(),
  SCHEDULER_MODE: z.enum(["legacy", "shadow", "active"]).optional(),
  PAUSE_API: envBooleanSchema.default(false),
  PAUSE_SCHEDULER: envBooleanSchema.default(false),
  PAUSE_JOBS: envBooleanSchema.default(false),
  AUTH_DATABASE_URL: z.string().default("pglite:.data/identity"),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  ACCOUNT_SECURITY_KEYS: z.string().optional(),
  ACCOUNT_SECURITY_KEY_VERSION: z.string().default("v1"),
  AUTH_PROVIDER_GENERATION: z.string().default("better-auth:v1"),
  AUTH_TERMS_MODE: termsModeSchema.optional(),
  AUTH_TERMS_VERSION: z.string().optional(),
  PHONE_AUTH_MODE: z.enum(["disabled", "sms_only", "whatsapp_first"]).default("disabled"),
  TRUSTED_ORIGINS: z.string().default("http://localhost:5173,http://localhost:4173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5175"),
  /** Shared secret for EDaya Spark guardian resolution. Requests without it are rejected. */
  EDAYA_SPARK_RESOLVE_SECRET: z.string().min(1).optional(),
  /** Email transport for in-process notify (`log` local default; `cloudflare` on the API Worker) */
  EMAIL_TRANSPORT: z.enum(["log", "cloudflare", "smtp"]).optional(),
  /** SMS transport (`log` locally; unimplemented on the API Worker until a provider is registered) */
  ...smsEnvironmentFields,
  /** From header for in-process notify, e.g. `EDAYA <noreply@edayaplus.com>` */
  EMAIL_FROM: z.string().min(1).optional(),
  /** Optional REST credentials for local auth email delivery, including isolated CI fixtures. */
  CLOUDFLARE_EMAIL_ACCOUNT_ID: z.string().trim().optional(),
  CLOUDFLARE_EMAIL_API_TOKEN: z.string().trim().optional(),
  /** Firebase Cloud Messaging HTTP v1 service-account JSON (Worker secret) */
  FCM_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  /** When true, allow POST /core/onboarding/register-school for authenticated unlinked users and active owners of their selected school. */
  ALLOW_PUBLIC_SCHOOL_REGISTRATION: envBooleanSchema.optional(),
  ALLOW_PUBLIC_ACCOUNT_REGISTRATION: envBooleanSchema.optional(),
  /** Comma-separated identity emails that may bootstrap the first platform operators. */
  PLATFORM_BOOTSTRAP_EMAILS: z.string().default(""),
  /** Webapp origin used to build invitation accept links, e.g. http://localhost:5173 */
  WEBAPP_ORIGIN: z.string().url().optional(),
  /** When false, account invitations are disabled (auto-invite and manual send). Defaults to true. */
  ACCOUNT_INVITATIONS_ENABLED: envBooleanSchema.optional(),
  /** JPEG portrait admission cap in bytes. Defaults to 1 MiB. */
  PROFILE_PHOTO_MAX_BYTES: z.coerce.number().int().positive().default(1_048_576),
  /** Optional Gotenberg base URL for local / wrangler-dev HTML→PDF (e.g. http://localhost:3000). */
  GOTENBERG_URL: z.string().url().optional(),
  /** Optional Chrome/Chromium binary for local HTML→PDF when Gotenberg is unset. Blank keeps the stub. */
  CHROME_PATH: z.string().optional(),
  /** When true, schedule report-card PDF render after publishReportCardResult. */
  DOCS_RENDER_ON_PUBLISH: envBooleanSchema.optional(),
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
  /** Shared secret for local file storage tokens and internal API */
  LOCAL_FILES_SECRET: z.string().min(1).optional(),
  /** Local one-shot cron (`bun cron:local`): comma-separated job keys; default runs heartbeat tick */
  CRON_JOB_KEYS: z.string().optional(),
}).catchall(z.any()).superRefine(validateSmsEnvironment).transform(env => ({
  ...env,
  AUTH_TERMS_MODE: resolveTermsMode(env.AUTH_TERMS_MODE, env.NODE_ENV),
}));

export type Environment = z.infer<typeof EnvSchema> & {
  SCHEDULER_DB?: import("@/runtime/shared/adapters/sqlite-scheduler").SchedulerDatabase;
  CRON_JOBS?: CronJobsQueueBinding;
  EMAIL?: CloudflareEmailBinding;
  BROWSER?: BrowserRunBinding;
  HYPERDRIVE_AUTH?: { connectionString?: string };
  AUTH_KV?: unknown;
};

export function parseEnv(data: Record<string, unknown>) {
  const { data: env, error } = EnvSchema.safeParse(data);

  if (error) {
    const errorMessage = `❌ Invalid env - ${Object.entries(error.flatten().fieldErrors).map(([key, errors]) => `${key}: ${errors?.join(",")}`).join(" | ")}`;
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

export function readEmailBinding(source: RuntimeBindings): CloudflareEmailBinding | undefined {
  const binding = source.EMAIL;
  if (binding && typeof binding === "object" && "send" in binding && typeof binding.send === "function") {
    return binding as CloudflareEmailBinding;
  }
  return undefined;
}

export function readBrowserBinding(source: RuntimeBindings): BrowserRunBinding | undefined {
  const binding = source.BROWSER;
  if (binding && typeof binding === "object" && "quickAction" in binding
    && typeof (binding as { quickAction?: unknown }).quickAction === "function") {
    return binding as BrowserRunBinding;
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
  const email = readEmailBinding(source);
  const browser = readBrowserBinding(source);

  return {
    ...env,
    ...(cronJobs ? { CRON_JOBS: cronJobs } : {}),
    ...(email ? { EMAIL: email } : {}),
    ...(browser ? { BROWSER: browser } : {}),

  };
}
