import type { RuntimeBindings, RuntimeKind } from "@/lib/runtime/types";

import { z } from "zod";
import { resolveDatabaseUrl } from "@/lib/runtime/hyperdrive";

export const EnvSchema = z.object({
  RUNTIME: z.enum(["node", "worker"]).default("node"),
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string(),
  BETTER_AUTH_SECRET: z.string().default("super-secret-placeholder-key-for-local-testing"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:9999"),
  TRUSTED_ORIGINS: z.string().default("http://localhost:5173,http://localhost:4173"),
  COOKIE_DOMAIN: z.string().optional(),
  SYSTEM_ACTOR_SECRET: z.string().min(1).optional(),
  GRANTS_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
  /** When true, run dev seed on startup. When unset, seeds automatically in development with pglite/memory. */
  SEED_ON_START: z.coerce.boolean().optional(),
  /** When true, allow POST /core/onboarding/register-school for authenticated unlinked users. */
  ALLOW_PUBLIC_SCHOOL_REGISTRATION: z.coerce.boolean().optional(),
});

export type Environment = z.infer<typeof EnvSchema>;

export function parseEnv(data: Record<string, unknown>) {
  const { data: env, error } = EnvSchema.safeParse(data);

  if (error) {
    const errorMessage = `❌ Invalid env - ${Object.entries(error.flatten().fieldErrors).map(([key, errors]) => `${key}: ${errors.join(",")}`).join(" | ")}`;
    throw new Error(errorMessage);
  }

  return env;
}

export function parseRuntimeEnv(
  source: RuntimeBindings,
  runtime: RuntimeKind = inferRuntimeKind(source),
): Environment {
  return parseEnv({
    ...source,
    RUNTIME: runtime,
    DATABASE_URL: resolveDatabaseUrl(source, runtime),
  });
}

function inferRuntimeKind(source: RuntimeBindings): RuntimeKind {
  const value = source.RUNTIME;
  if (value === "node" || value === "worker") {
    return value;
  }
  return "node";
}

export function shouldAllowPublicSchoolRegistration(env: Environment): boolean {
  if (env.ALLOW_PUBLIC_SCHOOL_REGISTRATION === true) {
    return true;
  }
  if (env.ALLOW_PUBLIC_SCHOOL_REGISTRATION === false) {
    return false;
  }
  return env.NODE_ENV === "development";
}
