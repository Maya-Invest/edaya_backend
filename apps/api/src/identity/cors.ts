import type { Environment } from "./env";
import { trustedOrigins } from "./env";

export function isLocalDevOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    return (protocol === "http:" || protocol === "https:")
      && (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "10.0.2.2");
  }
  catch {
    return false;
  }
}
export function resolveCorsOrigin(origin: string | undefined, env: Environment): string | undefined {
  if (!origin) {
    return undefined;
  }
  if (trustedOrigins(env).includes(origin)) {
    return origin;
  }
  if (env.NODE_ENV === "development" && isLocalDevOrigin(origin)) {
    return origin;
  }
  return undefined;
}
