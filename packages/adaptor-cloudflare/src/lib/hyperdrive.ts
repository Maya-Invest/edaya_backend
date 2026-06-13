import type { RuntimeBindings, RuntimeKind } from "./types";

const HYPERDRIVE_BINDING = "HYPERDRIVE";

function readHyperdriveConnectionString(source: RuntimeBindings): string | undefined {
  const hyperdrive = source[HYPERDRIVE_BINDING];
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
    const hyperdriveConnectionString = readHyperdriveConnectionString(source);
    if (hyperdriveConnectionString) {
      return hyperdriveConnectionString;
    }
  }

  const databaseUrl = source["DATABASE_URL"];
  if (typeof databaseUrl === "string" && databaseUrl.length > 0) {
    return databaseUrl;
  }

  throw new Error("DATABASE_URL is required");
}

export function usesHyperdriveBinding(source: RuntimeBindings, runtime: RuntimeKind): boolean {
  return runtime === "worker" && readHyperdriveConnectionString(source) !== undefined;
}
