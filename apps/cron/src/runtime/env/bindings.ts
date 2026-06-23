import type { RuntimeBindings, RuntimeKind } from "@/runtime/types";

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

export function resolveDatabaseUrl(source: RuntimeBindings, runtime: RuntimeKind): string {
  if (runtime === "worker") {
    const hyperdriveConnectionString = readHyperdriveConnectionString(source);
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

export function inferRuntimeKind(source: RuntimeBindings): RuntimeKind {
  const value = source.RUNTIME;
  if (value === "node" || value === "worker") {
    return value;
  }
  return "node";
}

export function prepareRuntimeBindings(
  source: RuntimeBindings,
  runtime: RuntimeKind = inferRuntimeKind(source),
): RuntimeBindings & { RUNTIME: RuntimeKind; DATABASE_URL: string } {
  return {
    ...source,
    RUNTIME: runtime,
    DATABASE_URL: resolveDatabaseUrl(source, runtime),
  };
}
