import type { Environment } from "@/runtime";

const DEFAULT_ORIGINS = ["http://localhost:5173", "http://localhost:4173"];

export function trustedOriginsFromEnv(trustedOrigins: string | undefined): string[] {
  if (!trustedOrigins) {
    return DEFAULT_ORIGINS;
  }

  const parsed = trustedOrigins.split(",").map(origin => origin.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_ORIGINS;
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    return (protocol === "http:" || protocol === "https:")
      && (hostname === "localhost" || hostname === "127.0.0.1");
  }
  catch {
    return false;
  }
}

export function resolveCorsOrigin(origin: string | undefined, env: Environment): string {
  const allowedOrigins = trustedOriginsFromEnv(env.TRUSTED_ORIGINS);
  if (!origin) {
    return allowedOrigins[0] ?? DEFAULT_ORIGINS[0]!;
  }
  if (allowedOrigins.includes(origin)) {
    return origin;
  }
  if (env.NODE_ENV === "development" && isLocalDevOrigin(origin)) {
    return origin;
  }
  return allowedOrigins[0] ?? DEFAULT_ORIGINS[0]!;
}
