import { z } from "zod";

export const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string(),
  BETTER_AUTH_SECRET: z.string().default("super-secret-placeholder-key-for-local-testing"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:9999"),
  SYSTEM_ACTOR_SECRET: z.string().min(1).optional(),
  GRANTS_CACHE_TTL_MS: z.coerce.number().int().positive().optional(),
});

export type Environment = z.infer<typeof EnvSchema>;
