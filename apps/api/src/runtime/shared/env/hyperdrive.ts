import type { RuntimeBindings, RuntimeKind } from "@/runtime/types";

const HYPERDRIVE_BINDING = "HYPERDRIVE";
const HYPERDRIVE_AUTH_BINDING = "HYPERDRIVE_AUTH";

function readHyperdriveConnectionString(
  source: RuntimeBindings,
  bindingName: string,
): string | undefined {
  const hyperdrive = source[bindingName];
  if (!hyperdrive || typeof hyperdrive !== "object") {
    return undefined;
  }

  const connectionString = (hyperdrive as { connectionString?: unknown }).connectionString;
  return typeof connectionString === "string" && connectionString.length > 0
    ? connectionString
    : undefined;
}

/** Prefer the Worker Hyperdrive binding on the worker runtime; fall back to DATABASE_URL elsewhere. */
export function resolveDatabaseUrl(source: RuntimeBindings, runtime: RuntimeKind): string {
  if (runtime === "worker") {
    const hyperdriveConnectionString = readHyperdriveConnectionString(source, HYPERDRIVE_BINDING);
    if (hyperdriveConnectionString) {
      return hyperdriveConnectionString;
    }
  }

  const databaseUrl = source.DATABASE_URL;
  if (typeof databaseUrl === "string" && databaseUrl.length > 0) {
    return databaseUrl;
  }

  throw new Error("DATABASE_URL is required");
}

/**
 * Auth/session DB URL for Worker: prefer cache-disabled Hyperdrive so Better Auth
 * read-after-write (sign-up → sign-in) is not served from Hyperdrive query cache.
 * An explicit AUTH_DATABASE_URL takes precedence over the school fallback.
 */
export function resolveAuthDatabaseUrl(source: RuntimeBindings, runtime: RuntimeKind): string {
  if (runtime === "worker") {
    const authHyperdrive = readHyperdriveConnectionString(source, HYPERDRIVE_AUTH_BINDING);
    if (authHyperdrive) {
      return authHyperdrive;
    }
  }

  if (typeof source.AUTH_DATABASE_URL === "string" && source.AUTH_DATABASE_URL.length > 0) {
    return source.AUTH_DATABASE_URL;
  }
  if (runtime === "worker" && source.NODE_ENV === "production") {
    throw new Error("Production requires cache-disabled HYPERDRIVE_AUTH or a direct AUTH_DATABASE_URL");
  }
  return resolveDatabaseUrl(source, runtime);
}

export function usesHyperdriveBinding(source: RuntimeBindings, runtime: RuntimeKind): boolean {
  return runtime === "worker"
    && readHyperdriveConnectionString(source, HYPERDRIVE_BINDING) !== undefined;
}

export function usesAuthHyperdriveBinding(source: RuntimeBindings, runtime: RuntimeKind): boolean {
  return runtime === "worker"
    && readHyperdriveConnectionString(source, HYPERDRIVE_AUTH_BINDING) !== undefined;
}
