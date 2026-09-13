import type { BrowserRunBinding } from "@edaya/adaptor-docs";
import type { CloudflareEmailBinding } from "@edaya/adaptor-notify";
import type { RuntimeBindings, RuntimeKind } from "@/runtime/types";
import type { CronJobsQueueBinding } from "@/runtime/worker/adapters/cloudflare-queue-cron-job-dispatcher";
import { z } from "zod";
import { inferRuntimeKind, prepareRuntimeBindings } from "@/runtime/shared/env/bindings";

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
  ENABLE_GRAPHQL: envBooleanSchema.optional(),
  RUN_MIGRATIONS_ON_STARTUP: envBooleanSchema.optional(),
  API_ORIGIN: z.string().url().default("http://localhost:9999"),
  IDENTITY_ISSUER: z.string().url().default("http://localhost:9900"),
  IDENTITY_DIRECTORY_URL: z.string().url().default("http://localhost:9900"),
  IDENTITY_DIRECTORY_SECRET: z.string().min(1).default("local-directory-secret"),
  TRUSTED_ORIGINS: z.string().default("http://localhost:5173,http://localhost:4173"),
  /** Required for EMAIL_TRANSPORT=novu. */
  NOVU_SECRET_KEY: z.string().min(1).optional(),
  /** Optional Novu API base URL (e.g. https://api.novu.co) */
  NOVU_API_URL: z.string().url().optional(),
  /** Provider webhook signing secret (Novu: Svix) — required for POST /webhooks/notification-delivery for Novu email receipts */
  NOVU_WEBHOOK_SECRET: z.string().min(1).optional(),
  /** Email transport for in-process notify (`log` local default; `cloudflare` on the API Worker) */
  EMAIL_TRANSPORT: z.enum(["log", "cloudflare", "smtp", "novu"]).optional(),
  /** From header for in-process notify, e.g. `EDAYA <noreply@edayaplus.com>` */
  EMAIL_FROM: z.string().min(1).optional(),
  /** Firebase Cloud Messaging HTTP v1 service-account JSON (Worker secret) */
  FCM_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  /** When true, allow POST /core/onboarding/register-school for authenticated unlinked users. */
  ALLOW_PUBLIC_SCHOOL_REGISTRATION: envBooleanSchema.optional(),
  /** Comma-separated identity emails that may bootstrap the first platform operators. */
  PLATFORM_BOOTSTRAP_EMAILS: z.string().default(""),
  /** Webapp origin used to build invitation accept links, e.g. http://localhost:5173 */
  WEBAPP_ORIGIN: z.string().url().optional(),
  /** When false, account invitations are disabled (auto-invite and manual send). Defaults to true. */
  ACCOUNT_INVITATIONS_ENABLED: envBooleanSchema.optional(),
  /** Optional Gotenberg base URL for local / wrangler-dev HTML→PDF (e.g. http://localhost:3000). */
  GOTENBERG_URL: z.string().url().optional(),
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
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === "production" && env.IDENTITY_DIRECTORY_SECRET === "local-directory-secret") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["IDENTITY_DIRECTORY_SECRET"],
      message: "Production requires an explicit identity directory secret",
    });
  }
});

export interface IdentityServiceBinding {
  fetch: typeof fetch;
}

export type Environment = z.infer<typeof EnvSchema> & {
  CRON_JOBS?: CronJobsQueueBinding;
  EMAIL?: CloudflareEmailBinding;
  BROWSER?: BrowserRunBinding;
  IDENTITY?: IdentityServiceBinding;
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
    ...(source.IDENTITY ? { IDENTITY: source.IDENTITY as IdentityServiceBinding } : {}),
  };
}
