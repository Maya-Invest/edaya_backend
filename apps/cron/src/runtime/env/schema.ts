import { z } from "zod";
import { inferRuntimeKind, prepareRuntimeBindings } from "@/runtime/env/bindings";
import type { RuntimeBindings, RuntimeKind } from "@/runtime/types";

export const CronEnvSchema = z.object({
  RUNTIME: z.enum(["node", "worker"]).default("node"),
  NODE_ENV: z.string().default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string(),
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
