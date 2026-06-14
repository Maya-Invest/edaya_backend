import type { D1Database } from "@cloudflare/workers-types";
import { inferRuntimeKind, prepareRuntimeBindings } from "@/runtime/env/bindings";
import type { RuntimeBindings, RuntimeKind } from "@/runtime/types";
import { z } from "zod";

export const EnvSchema = z.object({
  RUNTIME: z.enum(["node", "worker"]).default("node"),
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string(),
  AUTH_DATABASE_PATH: z.string().default(".data/auth.sqlite"),
  BETTER_AUTH_SECRET: z.string().default("super-secret-placeholder-key-for-local-testing"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:9999"),
  TRUSTED_ORIGINS: z.string().default("http://localhost:5173,http://localhost:4173"),
  COOKIE_DOMAIN: z.string().optional(),
  GRANTS_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
  /** When true, allow POST /core/onboarding/register-school for authenticated unlinked users. */
  ALLOW_PUBLIC_SCHOOL_REGISTRATION: z.coerce.boolean().optional(),
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
  const env = parseEnv(prepareRuntimeBindings(source, runtime));
  const authDb = readAuthDbBinding(source);
  return authDb ? { ...env, AUTH_DB: authDb } : env;
}
