import { z } from "zod";
import { inferRuntimeKind, prepareRuntimeBindings } from "@/runtime/shared/env/bindings";
import type { RuntimeBindings, RuntimeKind } from "@/runtime/types";

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

export const CronEnvSchema = z.object({
  RUNTIME: z.enum(["local", "worker"]).default("local"),
  NODE_ENV: z.string().default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string(),
  RUN_MIGRATIONS_ON_STARTUP: envBooleanSchema.optional(),
  NOVU_SECRET_KEY: z.string().min(1).optional(),
  NOVU_API_URL: z.string().url().optional(),
  CRON_JOB_KEYS: z.string().optional(),
});

export type Environment = z.infer<typeof CronEnvSchema>;

export function parseEnv(data: Record<string, unknown>): Environment {
  const { data: env, error } = CronEnvSchema.safeParse(data);
  if (error) {
    const errorMessage = `Invalid cron env - ${Object.entries(error.flatten().fieldErrors).map(([key, errors]) => `${key}: ${errors.join(",")}`).join(" | ")}`;
    throw new Error(errorMessage);
  }
  return env;
}

export function parseRuntimeEnv(
  source: RuntimeBindings,
  runtime: RuntimeKind = inferRuntimeKind(source),
): Environment {
  return parseEnv(prepareRuntimeBindings(source, runtime));
}
