import type { Environment } from "@/lib/runtime/env";

const DEFAULT_ORIGINS = ["http://localhost:5173", "http://localhost:4173"];

export function trustedOriginsFromEnv(trustedOrigins: string | undefined): string[] {
  if (!trustedOrigins) {
    return DEFAULT_ORIGINS;
  }

  const parsed = trustedOrigins.split(",").map(origin => origin.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_ORIGINS;
}

export function resolveCorsOrigin(origin: string | undefined, env: Environment): string {
  const allowedOrigins = trustedOriginsFromEnv(env.TRUSTED_ORIGINS);
  if (!origin) {
    return allowedOrigins[0] ?? DEFAULT_ORIGINS[0]!;
  }
  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? DEFAULT_ORIGINS[0]!;
}
